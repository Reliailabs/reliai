import "server-only";

import { createHash } from "crypto";
import { listLifecycles } from "@/lib/proposal-lifecycle";
import type { ProposalLifecycle } from "@/lib/proposal-lifecycle";
import { listVerificationResults } from "@/lib/verification-engine";
import type { VerificationResultRecord } from "@/lib/verification-engine";
import { getReliabilityScore } from "@/lib/reliability-scoring";
import type {
  OperationsSurfaceData,
  OperationsTimelineEntry,
  OperationsTimelineEventKind,
  OperationsTimelineFilter,
} from "@/components/dashboard/pulse-types";

// Re-export for consumers that want the filter type without a full pulse-types import.
export type { OperationsSurfaceData, OperationsTimelineEntry, OperationsTimelineFilter };

// ── Repository interface ──────────────────────────────────────────────────────
// Persistence-ready. Phase 11: replace InMemoryOperationsTimelineRepository
// at the defaultRepository assignment below.

export interface OperationsTimelineRepository {
  findAll(filter?: OperationsTimelineFilter): OperationsTimelineEntry[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function deterministicEntryId(...segments: string[]): string {
  return (
    "otl-" +
    createHash("sha256")
      .update(segments.join(":"))
      .digest("hex")
      .slice(0, 16)
  );
}

/**
 * Maps a lifecycle to_state to the corresponding Operations Center event kind.
 * Returns null for states that don't produce independent timeline entries.
 */
function toStateToEventKind(
  toState: string,
): OperationsTimelineEventKind | null {
  switch (toState) {
    case "analyzed":   return "proposal_generated";
    case "proposed":   return "policy_gate_evaluated";
    case "staged":     return "remediation_staged";
    case "approved":   return "approval_recorded";
    case "executing":  return "execution_boundary_entered";
    case "verified":   return "verification_result";
    case "failed":     return "verification_result";
    case "rolled_back": return "rollback_event";
    // "detected", "expired" → handled as lifecycle-level entries or skipped
    default:           return null;
  }
}

function entryTitle(
  kind: OperationsTimelineEventKind,
  ctx: { toState?: string; proposalId?: string | null; incidentId?: string | null },
): string {
  switch (kind) {
    case "incident_detected":
      return ctx.incidentId
        ? `Incident signal detected — ${ctx.incidentId}`
        : "Incident signal detected";
    case "proposal_generated":
      return ctx.proposalId
        ? `Automation proposal generated — ${ctx.proposalId.slice(0, 28)}…`
        : "Automation proposal generated";
    case "policy_gate_evaluated":
      return "Policy gate evaluated — eligibility checks passed";
    case "remediation_staged":
      return "Remediation step staged — awaiting operator review";
    case "approval_recorded":
      return "Operator approval recorded — evidence receipt queued";
    case "receipt_emitted":
      return "Evidence receipt emitted";
    case "execution_boundary_entered":
      return "Controlled execution boundary entered";
    case "verification_result":
      return ctx.toState === "verified"
        ? "Verification passed — outcome confirmed"
        : "Verification outcome not confirmed — failure recorded";
    case "rollback_event":
      return "Rollback initiated — execution reversed";
    case "kill_switch_event":
      return "Kill switch activated — all staged proposals blocked";
  }
}

// ── Build timeline from Phase 10.1 lifecycle data ────────────────────────────

function buildEntriesFromLifecycle(lc: ProposalLifecycle): OperationsTimelineEntry[] {
  const entries: OperationsTimelineEntry[] = [];
  const incidentId = lc.target_type === "incident" ? lc.target_id : null;
  const evidenceRef = { label: "Proposal record", href: `/operations?proposal=${lc.proposal_id}` };

  // Entry for initial detection (lifecycle created_at, state = "detected")
  entries.push({
    entry_id: deterministicEntryId(lc.lifecycle_id, "detected", lc.created_at),
    kind: "incident_detected",
    occurred_at: lc.created_at,
    organization_id: lc.organization_id,
    project_id: null,
    lifecycle_id: lc.lifecycle_id,
    proposal_id: lc.proposal_id,
    incident_id: incidentId,
    severity: null,
    lifecycle_state: "detected",
    actor_type: "system",
    actor_label: "Reliai System",
    title: entryTitle("incident_detected", { incidentId }),
    summary: `Reliability signal detected for ${lc.action_type} on ${lc.target_type} '${lc.target_id}'. Proposal lifecycle created and awaiting analysis.`,
    policy_gate_result: null,
    evidence_refs: [evidenceRef],
    requires_operator_review: true,
  });

  // One entry per state history transition
  for (const h of lc.state_history) {
    const kind = toStateToEventKind(h.to_state);
    if (!kind) continue;

    const isHumanActor = h.to_state === "approved" || h.to_state === "executing";
    const actorLabel = isHumanActor
      ? (lc.operator_email ?? "Operator")
      : "Reliai System";

    const policyGateResult: "passed" | "denied" | null =
      kind === "policy_gate_evaluated" || kind === "approval_recorded" ? "passed"
      : kind === "verification_result" && h.to_state === "verified" ? "passed"
      : kind === "verification_result" && h.to_state === "failed" ? "denied"
      : null;

    entries.push({
      entry_id: deterministicEntryId(lc.lifecycle_id, h.from_state, h.to_state, h.transitioned_at),
      kind,
      occurred_at: h.transitioned_at,
      organization_id: lc.organization_id,
      project_id: null,
      lifecycle_id: lc.lifecycle_id,
      proposal_id: lc.proposal_id,
      incident_id: incidentId,
      severity: null,
      lifecycle_state: h.to_state,
      actor_type: isHumanActor ? "human" : "system",
      actor_label: actorLabel,
      title: entryTitle(kind, {
        toState: h.to_state,
        proposalId: lc.proposal_id,
        incidentId,
      }),
      summary: h.reason
        ?? `Proposal transitioned from '${h.from_state}' to '${h.to_state}'.`,
      policy_gate_result: policyGateResult,
      evidence_refs: [evidenceRef],
      requires_operator_review: true,
    });

    // Immediately after "approved" transition: emit a receipt event
    if (h.to_state === "approved") {
      entries.push({
        entry_id: deterministicEntryId(lc.lifecycle_id, "receipt", h.transitioned_at),
        kind: "receipt_emitted",
        // 500ms offset to keep sort order deterministic
        occurred_at: new Date(
          new Date(h.transitioned_at).getTime() + 500,
        ).toISOString(),
        organization_id: lc.organization_id,
        project_id: null,
        lifecycle_id: lc.lifecycle_id,
        proposal_id: lc.proposal_id,
        incident_id: incidentId,
        severity: null,
        lifecycle_state: "approved",
        actor_type: "system",
        actor_label: "Reliai System",
        title: entryTitle("receipt_emitted", {}),
        summary: `Evidence receipt emitted for proposal '${lc.proposal_id.slice(0, 28)}…' following operator approval.`,
        policy_gate_result: "passed",
        evidence_refs: [
          { label: "Evidence receipt", href: `/operations?proposal=${lc.proposal_id}` },
        ],
        requires_operator_review: true,
      });
    }
  }

  return entries;
}

// ── Static fixture events ─────────────────────────────────────────────────────
// Kill-switch and a policy-denied gate result — not generated from lifecycle
// state transitions; demonstrate the full event-kind coverage.

const STATIC_FIXTURE_EVENTS: OperationsTimelineEntry[] = [
  {
    entry_id: deterministicEntryId("kill-switch", "org-demo", "2026-05-11T07:00:00.000Z"),
    kind: "kill_switch_event",
    occurred_at: "2026-05-11T07:00:00.000Z",
    organization_id: "org-demo",
    project_id: null,
    lifecycle_id: null,
    proposal_id: null,
    incident_id: null,
    severity: null,
    lifecycle_state: null,
    actor_type: "human",
    actor_label: "admin@acme.test",
    title: "Kill switch activated — all staged proposals blocked",
    summary:
      "Operator activated global kill switch at 07:00 UTC. All staged automation proposals for org-demo are blocked until the kill switch is cleared by an authorized operator.",
    policy_gate_result: "denied",
    evidence_refs: [],
    requires_operator_review: true,
  },
  {
    entry_id: deterministicEntryId(
      "policy-denied",
      "phase9-inc-denied0000001",
      "2026-05-10T06:00:00.000Z",
    ),
    kind: "policy_gate_evaluated",
    occurred_at: "2026-05-10T06:00:00.000Z",
    organization_id: "org-demo",
    project_id: null,
    lifecycle_id: null,
    proposal_id: "phase9-inc-denied0000001",
    incident_id: "inc-004",
    severity: "high",
    lifecycle_state: "analyzed",
    actor_type: "system",
    actor_label: "Reliai System",
    title: "Policy gate denied — blast radius exceeds boundary",
    summary:
      "Proposal 'phase9-inc-denied0000001' rejected at policy gate: blast_radius_exceeds_boundary. Estimated scope 'organization' exceeds max allowed 'environment'. Proposal will not advance to 'proposed' state.",
    policy_gate_result: "denied",
    evidence_refs: [
      {
        label: "Policy gate record",
        href: "/operations?proposal=phase9-inc-denied0000001",
      },
    ],
    requires_operator_review: true,
  },
];

// ── In-memory repository ──────────────────────────────────────────────────────

export class InMemoryOperationsTimelineRepository
  implements OperationsTimelineRepository
{
  private readonly entries: OperationsTimelineEntry[];

  constructor(seed?: OperationsTimelineEntry[]) {
    if (seed) {
      this.entries = seed;
    } else {
      const fromLifecycles = listLifecycles().flatMap(buildEntriesFromLifecycle);
      this.entries = [...fromLifecycles, ...STATIC_FIXTURE_EVENTS];
    }
  }

  findAll(filter?: OperationsTimelineFilter): OperationsTimelineEntry[] {
    const sorted = [...this.entries].sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
    if (!filter) return sorted;
    return sorted.filter((e) => {
      if (filter.kind && e.kind !== filter.kind) return false;
      if (filter.project_id !== undefined && e.project_id !== filter.project_id)
        return false;
      if (filter.incident_id !== undefined && e.incident_id !== filter.incident_id)
        return false;
      if (filter.proposal_id !== undefined && e.proposal_id !== filter.proposal_id)
        return false;
      if (filter.severity !== undefined && e.severity !== filter.severity)
        return false;
      if (
        filter.lifecycle_state !== undefined &&
        e.lifecycle_state !== filter.lifecycle_state
      )
        return false;
      if (filter.actor_type && e.actor_type !== filter.actor_type) return false;
      return true;
    });
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────
// Phase 11: replace with a DB-backed OperationsTimelineRepository.
const defaultRepository = new InMemoryOperationsTimelineRepository();

// ── Verification enrichment ───────────────────────────────────────────────────

/**
 * Replaces the generic summary on `verification_result` timeline entries with
 * outcome-specific rationale from the Verification Engine, and adds standalone
 * entries for verification results that don't have a matching lifecycle
 * transition (partial_recovery, no_change, verification_failed scenarios).
 */
function buildVerificationEnrichedEntries(
  baseEntries: OperationsTimelineEntry[],
  verificationResults: VerificationResultRecord[],
): OperationsTimelineEntry[] {
  // Index verification results by lifecycle_id for O(1) lookup.
  const byLifecycleId = new Map<string, VerificationResultRecord>(
    verificationResults.map((r) => [r.lifecycle_id, r]),
  );

  // Lifecycle IDs that already have a timeline entry derived from a transition.
  const coveredLifecycleIds = new Set<string>(
    baseEntries
      .filter((e) => e.kind === "verification_result" && e.lifecycle_id !== null)
      .map((e) => e.lifecycle_id as string),
  );

  // Enrich existing verification_result entries with engine rationale.
  const enriched = baseEntries.map((entry) => {
    if (
      entry.kind !== "verification_result" ||
      entry.lifecycle_id === null
    ) {
      return entry;
    }
    const vr = byLifecycleId.get(entry.lifecycle_id);
    if (!vr) return entry;

    const outcomeLabel: Record<string, string> = {
      recovered: "Verification passed — recovered",
      partial_recovery: "Verification passed — partial recovery",
      no_change: "Verification complete — no change detected",
      regressed: "Verification failed — regression detected",
      verification_failed: "Verification failed — insufficient telemetry",
    };

    return {
      ...entry,
      title: outcomeLabel[vr.outcome] ?? entry.title,
      summary: vr.rationale,
      policy_gate_result:
        vr.outcome === "recovered" || vr.outcome === "partial_recovery" || vr.outcome === "no_change"
          ? ("passed" as const)
          : ("denied" as const),
    };
  });

  // Add standalone entries for verification results with no lifecycle match.
  const standalone: OperationsTimelineEntry[] = verificationResults
    .filter((vr) => !coveredLifecycleIds.has(vr.lifecycle_id))
    .map((vr) => {
      const outcomeLabel: Record<string, string> = {
        recovered: "Verification passed — recovered",
        partial_recovery: "Verification passed — partial recovery",
        no_change: "Verification complete — no change detected",
        regressed: "Verification failed — regression detected",
        verification_failed: "Verification failed — insufficient telemetry",
      };

      return {
        entry_id: deterministicEntryId("vr-standalone", vr.result_id),
        kind: "verification_result" as OperationsTimelineEventKind,
        occurred_at: vr.computed_at,
        organization_id: "org-demo",
        project_id: null,
        lifecycle_id: vr.lifecycle_id,
        proposal_id: vr.proposal_id,
        incident_id: null,
        severity: null,
        lifecycle_state: null,
        actor_type: "system" as const,
        actor_label: "Reliai System",
        title: outcomeLabel[vr.outcome] ?? "Verification complete",
        summary: vr.rationale,
        policy_gate_result:
          vr.outcome === "recovered" || vr.outcome === "partial_recovery" || vr.outcome === "no_change"
            ? ("passed" as const)
            : ("denied" as const),
        evidence_refs: [
          { label: "Verification result", href: `/operations?proposal=${vr.proposal_id}` },
        ],
        requires_operator_review: true,
      };
    });

  return [...enriched, ...standalone];
}

// ── Public surface data function ──────────────────────────────────────────────

export async function getOperationsSurfaceData(): Promise<OperationsSurfaceData> {
  const base = defaultRepository.findAll();
  const verificationResults = listVerificationResults();
  const entries = buildVerificationEnrichedEntries(base, verificationResults);
  const reliabilityScore = getReliabilityScore();
  return {
    entries,
    reliabilityScore,
    sourceErrors: [],
    dataMode: "demo",
  };
}
