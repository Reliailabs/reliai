import { createHash } from "crypto";

import type { OperationsIntentProjection } from "@/lib/operations-ingest-projections";
import type { OperationsTimelineEntry } from "@/components/dashboard/pulse-types";

export function deterministicIntentEntryId(eventId: string): string {
  return (
    "otl-" +
    createHash("sha256")
      .update(`intent:${eventId}`)
      .digest("hex")
      .slice(0, 16)
  );
}

export function mapIntentProjectionsToTimelineEntries(
  lifecycleIntents: OperationsIntentProjection[],
  verificationIntents: OperationsIntentProjection[],
): OperationsTimelineEntry[] {
  const mappedLifecycle: OperationsTimelineEntry[] = lifecycleIntents.map((intent) => ({
    entry_id: deterministicIntentEntryId(intent.event_id),
    kind: "proposal_generated",
    occurred_at: intent.accepted_at,
    organization_id: intent.organization_id,
    project_id: null,
    lifecycle_id: intent.lifecycle_id,
    proposal_id: intent.proposal_id,
    incident_id: null,
    severity: null,
    lifecycle_state: null,
    actor_type: "system",
    actor_label: "Reliai System",
    title: "Lifecycle intent accepted",
    summary: `Lifecycle ingest intent accepted for target '${intent.target_id}'.`,
    policy_gate_result: null,
    evidence_refs: [{ label: "Ingest projection", href: "/operations" }],
    requires_operator_review: true,
  }));

  const mappedVerification: OperationsTimelineEntry[] = verificationIntents.map((intent) => ({
    entry_id: deterministicIntentEntryId(intent.event_id),
    kind: "verification_result",
    occurred_at: intent.accepted_at,
    organization_id: intent.organization_id,
    project_id: null,
    lifecycle_id: intent.lifecycle_id,
    proposal_id: intent.proposal_id,
    incident_id: null,
    severity: null,
    lifecycle_state: null,
    actor_type: "system",
    actor_label: "Reliai System",
    title: "Verification intent accepted",
    summary: `Verification ingest intent accepted (${intent.outcome ?? "unknown"}).`,
    policy_gate_result: intent.outcome === "passed" ? "passed" : intent.outcome === "failed" ? "denied" : null,
    evidence_refs: [{ label: "Ingest projection", href: "/operations" }],
    requires_operator_review: true,
  }));

  const merged = [...mappedLifecycle, ...mappedVerification];
  const byId = new Map<string, OperationsTimelineEntry>();
  for (const entry of merged) {
    byId.set(entry.entry_id, entry);
  }
  return Array.from(byId.values());
}

export function mergeTimelineEntriesWithIntentProjections(
  baseEntries: OperationsTimelineEntry[],
  intentEntries: OperationsTimelineEntry[],
): OperationsTimelineEntry[] {
  const byId = new Map<string, OperationsTimelineEntry>();
  for (const entry of [...baseEntries, ...intentEntries]) byId.set(entry.entry_id, entry);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
}
