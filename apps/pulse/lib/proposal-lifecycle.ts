import { createHash } from "crypto";
import type { ReadWriteRepository, RepositoryAdapter } from "@/lib/repository-contracts";

// ── State definitions ─────────────────────────────────────────────────────────
// Forward-only progression. Terminal states accept no further transitions.
// "executing" is a lifecycle label only — execution_granted is ALWAYS false.

export const PROPOSAL_LIFECYCLE_STATES = [
  "detected",
  "analyzed",
  "proposed",
  "staged",
  "approved",
  "executing",   // lifecycle label — execution_granted: false invariant always holds
  "verified",
  "failed",
  "rolled_back",
  "expired",
] as const;

export type ProposalLifecycleState = (typeof PROPOSAL_LIFECYCLE_STATES)[number];

export const TERMINAL_STATES: ReadonlySet<ProposalLifecycleState> = new Set([
  "verified",
  "failed",
  "rolled_back",
  "expired",
]);

// Valid forward-only transition edges. Any transition not listed here is rejected.
export const VALID_TRANSITIONS: ReadonlyMap<
  ProposalLifecycleState,
  ReadonlyArray<ProposalLifecycleState>
> = new Map([
  ["detected",  ["analyzed",  "expired"]],
  ["analyzed",  ["proposed",  "expired"]],
  ["proposed",  ["staged",    "expired"]],
  ["staged",    ["approved",  "expired"]],
  ["approved",  ["executing", "expired"]],
  ["executing", ["verified",  "failed", "rolled_back"]],
  // Terminal states intentionally absent — VALID_TRANSITIONS.get(terminal) returns undefined.
]);

// ── Entity types ──────────────────────────────────────────────────────────────

export type LifecycleStateHistoryEntry = {
  readonly from_state: ProposalLifecycleState;
  readonly to_state: ProposalLifecycleState;
  readonly transitioned_at: string; // ISO 8601
  readonly reason: string | null;
};

export type ProposalLifecycle = {
  readonly lifecycle_id: string;          // "lifecycle-" + 16-char sha256 hex
  readonly proposal_id: string;           // references Phase 9 phase9-* format
  readonly action_type: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly organization_id: string;
  readonly created_at: string;            // ISO 8601
  readonly expires_at: string;            // ISO 8601
  readonly execution_granted: false;      // invariant — NEVER true in Phase 10
  readonly requires_operator_review: true;
  state: ProposalLifecycleState;
  updated_at: string;                     // ISO 8601
  operator_email: string | null;          // set when transitioning to approved / executing
  verification_result_id: string | null;  // set when transitioning to verified
  failure_reason: string | null;          // set when transitioning to failed / rolled_back
  state_history: LifecycleStateHistoryEntry[];
};

// ── Repository interface ──────────────────────────────────────────────────────
// Persistence-ready boundary. Phase 11: replace InMemoryProposalLifecycleRepository
// with a DB-backed implementation at the defaultRepository assignment below.

export type LifecycleFilter = {
  organization_id?: string;
  state?: ProposalLifecycleState;
  proposal_id?: string;
};

export interface ProposalLifecycleRepository
  extends ReadWriteRepository<ProposalLifecycle, LifecycleFilter> {}

// ── In-memory fixture implementation ─────────────────────────────────────────

export class InMemoryProposalLifecycleRepository
  implements ProposalLifecycleRepository
{
  private readonly store: Map<string, ProposalLifecycle>;

  constructor(seed: ProposalLifecycle[] = LIFECYCLE_FIXTURES) {
    this.store = new Map(
      seed.map((lc) => [
        lc.lifecycle_id,
        { ...lc, state_history: [...lc.state_history] },
      ]),
    );
  }

  findById(lifecycleId: string): ProposalLifecycle | null {
    const found = this.store.get(lifecycleId);
    if (!found) return null;
    // Return a defensive copy so callers cannot mutate internal repo state.
    return { ...found, state_history: [...found.state_history] };
  }

  findAll(filter?: LifecycleFilter): ProposalLifecycle[] {
    const all = Array.from(this.store.values());
    if (!filter) return all;
    return all.filter((lc) => {
      if (filter.organization_id !== undefined && lc.organization_id !== filter.organization_id)
        return false;
      if (filter.state !== undefined && lc.state !== filter.state) return false;
      if (filter.proposal_id !== undefined && lc.proposal_id !== filter.proposal_id) return false;
      return true;
    });
  }

  save(lifecycle: ProposalLifecycle): ProposalLifecycle {
    const stored = { ...lifecycle, state_history: [...lifecycle.state_history] };
    this.store.set(stored.lifecycle_id, stored);
    // Return a separate copy so callers cannot mutate internal repo state.
    return { ...stored, state_history: [...stored.state_history] };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function deterministicLifecycleId(proposalId: string, createdAt: string): string {
  return (
    "lifecycle-" +
    createHash("sha256")
      .update(`${proposalId}:${createdAt}`)
      .digest("hex")
      .slice(0, 16)
  );
}

function lifecycleExpiresAt(createdAt: string, ttlHours = 24): string {
  return new Date(new Date(createdAt).getTime() + ttlHours * 60 * 60 * 1000).toISOString();
}

// ── Fixture data ──────────────────────────────────────────────────────────────
// Deterministic, covers all 10 states. Seeded from Phase 9 proposal_id format.

const LIFECYCLE_FIXTURES: ProposalLifecycle[] = [
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-a1b2c3d4e5f60001", "2026-05-08T08:00:00.000Z"),
    proposal_id: "phase9-inc-a1b2c3d4e5f60001",
    action_type: "ack",
    target_type: "incident",
    target_id: "inc-001",
    organization_id: "org-demo",
    state: "detected",
    created_at: "2026-05-08T08:00:00.000Z",
    updated_at: "2026-05-08T08:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-08T08:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-b2c3d4e5f6070002", "2026-05-08T09:00:00.000Z"),
    proposal_id: "phase9-inc-b2c3d4e5f6070002",
    action_type: "assign",
    target_type: "incident",
    target_id: "inc-002",
    organization_id: "org-demo",
    state: "analyzed",
    created_at: "2026-05-08T09:00:00.000Z",
    updated_at: "2026-05-08T09:30:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-08T09:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected", to_state: "analyzed", transitioned_at: "2026-05-08T09:30:00.000Z", reason: null },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-c3d4e5f607080003", "2026-05-09T08:00:00.000Z"),
    proposal_id: "phase9-inc-c3d4e5f607080003",
    action_type: "open_remediation_task",
    target_type: "incident",
    target_id: "inc-003",
    organization_id: "org-demo",
    state: "proposed",
    created_at: "2026-05-09T08:00:00.000Z",
    updated_at: "2026-05-09T10:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-09T08:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected",  to_state: "analyzed", transitioned_at: "2026-05-09T09:00:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-09T10:00:00.000Z", reason: null },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-d4e5f60708090004", "2026-05-09T12:00:00.000Z"),
    proposal_id: "phase9-inc-d4e5f60708090004",
    action_type: "propose_guardrail",
    target_type: "guardrail_policy",
    target_id: "gp-001",
    organization_id: "org-demo",
    state: "staged",
    created_at: "2026-05-09T12:00:00.000Z",
    updated_at: "2026-05-09T14:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-09T12:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected",  to_state: "analyzed",  transitioned_at: "2026-05-09T12:30:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-09T13:00:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",    transitioned_at: "2026-05-09T14:00:00.000Z", reason: null },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-e5f6070809100005", "2026-05-10T08:00:00.000Z"),
    proposal_id: "phase9-inc-e5f6070809100005",
    action_type: "rollback",
    target_type: "deployment",
    target_id: "dep-007",
    organization_id: "org-demo",
    state: "approved",
    created_at: "2026-05-10T08:00:00.000Z",
    updated_at: "2026-05-10T09:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-10T08:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "operator@acme.test",
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected",  to_state: "analyzed",  transitioned_at: "2026-05-10T08:15:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-10T08:30:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",    transitioned_at: "2026-05-10T08:45:00.000Z", reason: null },
      { from_state: "staged",    to_state: "approved",  transitioned_at: "2026-05-10T09:00:00.000Z", reason: "Operator approved." },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-f607080910110006", "2026-05-10T10:00:00.000Z"),
    proposal_id: "phase9-inc-f607080910110006",
    action_type: "rollback",
    target_type: "deployment",
    target_id: "dep-008",
    organization_id: "org-demo",
    state: "executing",
    created_at: "2026-05-10T10:00:00.000Z",
    updated_at: "2026-05-10T11:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-10T10:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "operator@acme.test",
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected",  to_state: "analyzed",  transitioned_at: "2026-05-10T10:15:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-10T10:30:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",    transitioned_at: "2026-05-10T10:45:00.000Z", reason: null },
      { from_state: "staged",    to_state: "approved",  transitioned_at: "2026-05-10T10:55:00.000Z", reason: "Operator approved." },
      { from_state: "approved",  to_state: "executing", transitioned_at: "2026-05-10T11:00:00.000Z", reason: "Operator 'operator@acme.test' initiated controlled execution workflow." },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-0708091011120007", "2026-05-10T12:00:00.000Z"),
    proposal_id: "phase9-inc-0708091011120007",
    action_type: "ack",
    target_type: "incident",
    target_id: "inc-007",
    organization_id: "org-demo",
    state: "verified",
    created_at: "2026-05-10T12:00:00.000Z",
    updated_at: "2026-05-10T13:30:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-10T12:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "operator@acme.test",
    verification_result_id: "vr-a1b2c3d4e5f60007",
    failure_reason: null,
    state_history: [
      { from_state: "detected",  to_state: "analyzed",  transitioned_at: "2026-05-10T12:15:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-10T12:30:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",    transitioned_at: "2026-05-10T12:45:00.000Z", reason: null },
      { from_state: "staged",    to_state: "approved",  transitioned_at: "2026-05-10T13:00:00.000Z", reason: "Operator approved." },
      { from_state: "approved",  to_state: "executing", transitioned_at: "2026-05-10T13:10:00.000Z", reason: "Operator 'operator@acme.test' initiated controlled execution workflow." },
      { from_state: "executing", to_state: "verified",  transitioned_at: "2026-05-10T13:30:00.000Z", reason: "Verification result 'vr-a1b2c3d4e5f60007' recorded." },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-08091011121300008", "2026-05-11T08:00:00.000Z"),
    proposal_id: "phase9-inc-08091011121300008",
    action_type: "rollback",
    target_type: "deployment",
    target_id: "dep-009",
    organization_id: "org-demo",
    state: "failed",
    created_at: "2026-05-11T08:00:00.000Z",
    updated_at: "2026-05-11T09:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-11T08:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "operator@acme.test",
    verification_result_id: null,
    failure_reason: "Deployment target dep-009 was not reachable during execution window.",
    state_history: [
      { from_state: "detected",  to_state: "analyzed",  transitioned_at: "2026-05-11T08:10:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",  transitioned_at: "2026-05-11T08:20:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",    transitioned_at: "2026-05-11T08:30:00.000Z", reason: null },
      { from_state: "staged",    to_state: "approved",  transitioned_at: "2026-05-11T08:45:00.000Z", reason: "Operator approved." },
      { from_state: "approved",  to_state: "executing", transitioned_at: "2026-05-11T08:50:00.000Z", reason: "Operator 'operator@acme.test' initiated controlled execution workflow." },
      { from_state: "executing", to_state: "failed",    transitioned_at: "2026-05-11T09:00:00.000Z", reason: "Deployment target dep-009 was not reachable during execution window." },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-091011121314000009", "2026-05-11T10:00:00.000Z"),
    proposal_id: "phase9-inc-091011121314000009",
    action_type: "rollback",
    target_type: "deployment",
    target_id: "dep-010",
    organization_id: "org-demo",
    state: "rolled_back",
    created_at: "2026-05-11T10:00:00.000Z",
    updated_at: "2026-05-11T11:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-11T10:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "operator@acme.test",
    verification_result_id: null,
    failure_reason: "External system rejected the rollback command — rolled back to safe state.",
    state_history: [
      { from_state: "detected",  to_state: "analyzed",   transitioned_at: "2026-05-11T10:10:00.000Z", reason: null },
      { from_state: "analyzed",  to_state: "proposed",   transitioned_at: "2026-05-11T10:20:00.000Z", reason: null },
      { from_state: "proposed",  to_state: "staged",     transitioned_at: "2026-05-11T10:30:00.000Z", reason: null },
      { from_state: "staged",    to_state: "approved",   transitioned_at: "2026-05-11T10:45:00.000Z", reason: "Operator approved." },
      { from_state: "approved",  to_state: "executing",  transitioned_at: "2026-05-11T10:50:00.000Z", reason: "Operator 'operator@acme.test' initiated controlled execution workflow." },
      { from_state: "executing", to_state: "rolled_back",transitioned_at: "2026-05-11T11:00:00.000Z", reason: "External system rejected the rollback command — rolled back to safe state." },
    ],
  },
  {
    lifecycle_id: deterministicLifecycleId("phase9-inc-1011121314150000010", "2026-05-11T12:00:00.000Z"),
    proposal_id: "phase9-inc-1011121314150000010",
    action_type: "assign",
    target_type: "incident",
    target_id: "inc-010",
    organization_id: "org-demo",
    state: "expired",
    created_at: "2026-05-11T12:00:00.000Z",
    updated_at: "2026-05-11T13:00:00.000Z",
    expires_at: lifecycleExpiresAt("2026-05-11T12:00:00.000Z"),
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [
      { from_state: "detected", to_state: "expired", transitioned_at: "2026-05-11T13:00:00.000Z", reason: "Lifecycle expired before operator review." },
    ],
  },
];

// ── Module-level default repository ──────────────────────────────────────────
// Phase 11: replace with a DB-backed ProposalLifecycleRepository implementation.
const defaultRepository: RepositoryAdapter<ProposalLifecycleRepository> =
  new InMemoryProposalLifecycleRepository();

// ── Result type ───────────────────────────────────────────────────────────────

export type LifecycleTransitionResult =
  | { ok: true; lifecycle: ProposalLifecycle; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

// ── Service functions ─────────────────────────────────────────────────────────

export function getLifecycleById(
  lifecycleId: string,
  repo: ProposalLifecycleRepository = defaultRepository,
): ProposalLifecycle | null {
  return repo.findById(lifecycleId);
}

export function listLifecycles(
  filter?: LifecycleFilter,
  repo: ProposalLifecycleRepository = defaultRepository,
): ProposalLifecycle[] {
  return repo.findAll(filter);
}

/**
 * Generic state transition. Validates the edge is permitted, checks expiry,
 * rejects terminal-state mutations, and appends to state_history.
 */
export function transitionLifecycle(
  lifecycleId: string,
  toState: ProposalLifecycleState,
  reason: string | null,
  repo: ProposalLifecycleRepository = defaultRepository,
  now: Date = new Date(),
): LifecycleTransitionResult {
  const existing = repo.findById(lifecycleId);
  if (!existing) {
    return {
      ok: false,
      errors: [`lifecycle_id '${lifecycleId}' not found.`],
      warnings: [],
    };
  }

  if (TERMINAL_STATES.has(existing.state)) {
    return {
      ok: false,
      errors: [
        `lifecycle '${lifecycleId}' is in terminal state '${existing.state}' — no further transitions are permitted.`,
      ],
      warnings: [],
    };
  }

  // Expiry guard: only allow explicit expiry transition if lifecycle has passed its TTL
  if (
    toState !== "expired" &&
    now.getTime() > new Date(existing.expires_at).getTime()
  ) {
    return {
      ok: false,
      errors: [
        `lifecycle '${lifecycleId}' has expired at '${existing.expires_at}' — transition to '${toState}' is not permitted. Transition to 'expired' instead.`,
      ],
      warnings: [],
    };
  }

  const allowed = VALID_TRANSITIONS.get(existing.state) ?? [];
  if (!(allowed as ReadonlyArray<string>).includes(toState)) {
    return {
      ok: false,
      errors: [
        `transition from '${existing.state}' to '${toState}' is not permitted. ` +
          `Valid transitions from '${existing.state}': [${allowed.join(", ")}].`,
      ],
      warnings: [],
    };
  }

  const nowIso = now.toISOString();
  const warnings: string[] = [];

  if (toState === "executing") {
    warnings.push(
      "State is 'executing' — execution_granted remains false. This is a lifecycle label only, not an execution authority grant.",
    );
  }

  const updated: ProposalLifecycle = {
    ...existing,
    state: toState,
    updated_at: nowIso,
    state_history: [
      ...existing.state_history,
      { from_state: existing.state, to_state: toState, transitioned_at: nowIso, reason },
    ],
  };

  const saved = repo.save(updated);
  return { ok: true, lifecycle: saved, warnings };
}

/**
 * Specific helper: approved → executing.
 * Records the approving operator's email and emits the invariant warning.
 */
export function completeProposalExecution(
  lifecycleId: string,
  operatorEmail: string,
  repo: ProposalLifecycleRepository = defaultRepository,
  now: Date = new Date(),
): LifecycleTransitionResult {
  const existing = repo.findById(lifecycleId);
  if (!existing) {
    return {
      ok: false,
      errors: [`lifecycle_id '${lifecycleId}' not found.`],
      warnings: [],
    };
  }
  if (existing.state !== "approved") {
    return {
      ok: false,
      errors: [
        `completeProposalExecution requires state 'approved', but lifecycle '${lifecycleId}' is in state '${existing.state}'.`,
      ],
      warnings: [],
    };
  }
  if (!operatorEmail || !operatorEmail.includes("@")) {
    return {
      ok: false,
      errors: ["operatorEmail must be a valid email address."],
      warnings: [],
    };
  }

  const nowIso = now.toISOString();
  const updated: ProposalLifecycle = {
    ...existing,
    state: "executing",
    operator_email: operatorEmail,
    updated_at: nowIso,
    state_history: [
      ...existing.state_history,
      {
        from_state: "approved",
        to_state: "executing",
        transitioned_at: nowIso,
        reason: `Operator '${operatorEmail}' initiated controlled execution workflow.`,
      },
    ],
  };

  const saved = repo.save(updated);
  return {
    ok: true,
    lifecycle: saved,
    warnings: [
      "State is 'executing' — execution_granted remains false. This is a lifecycle label only, not an execution authority grant.",
    ],
  };
}

/**
 * Specific helper: executing → verified.
 * Records the verification result ID that confirms the outcome.
 */
export function verifyProposalOutcome(
  lifecycleId: string,
  verificationResultId: string,
  repo: ProposalLifecycleRepository = defaultRepository,
  now: Date = new Date(),
): LifecycleTransitionResult {
  const existing = repo.findById(lifecycleId);
  if (!existing) {
    return {
      ok: false,
      errors: [`lifecycle_id '${lifecycleId}' not found.`],
      warnings: [],
    };
  }
  if (existing.state !== "executing") {
    return {
      ok: false,
      errors: [
        `verifyProposalOutcome requires state 'executing', but lifecycle '${lifecycleId}' is in state '${existing.state}'.`,
      ],
      warnings: [],
    };
  }
  if (!verificationResultId || verificationResultId.trim().length === 0) {
    return {
      ok: false,
      errors: ["verificationResultId must be a non-empty string."],
      warnings: [],
    };
  }

  const nowIso = now.toISOString();
  const updated: ProposalLifecycle = {
    ...existing,
    state: "verified",
    verification_result_id: verificationResultId,
    updated_at: nowIso,
    state_history: [
      ...existing.state_history,
      {
        from_state: "executing",
        to_state: "verified",
        transitioned_at: nowIso,
        reason: `Verification result '${verificationResultId}' recorded.`,
      },
    ],
  };

  const saved = repo.save(updated);
  return { ok: true, lifecycle: saved, warnings: [] };
}

/**
 * Specific helper: executing → failed | rolled_back.
 * Set rollback=true to record a structured rollback instead of a plain failure.
 */
export function failProposalExecution(
  lifecycleId: string,
  failureReason: string,
  rollback: boolean,
  repo: ProposalLifecycleRepository = defaultRepository,
  now: Date = new Date(),
): LifecycleTransitionResult {
  const existing = repo.findById(lifecycleId);
  if (!existing) {
    return {
      ok: false,
      errors: [`lifecycle_id '${lifecycleId}' not found.`],
      warnings: [],
    };
  }
  if (existing.state !== "executing") {
    return {
      ok: false,
      errors: [
        `failProposalExecution requires state 'executing', but lifecycle '${lifecycleId}' is in state '${existing.state}'.`,
      ],
      warnings: [],
    };
  }
  if (!failureReason || failureReason.trim().length === 0) {
    return {
      ok: false,
      errors: ["failureReason must be a non-empty string."],
      warnings: [],
    };
  }

  const toState: ProposalLifecycleState = rollback ? "rolled_back" : "failed";
  const nowIso = now.toISOString();
  const updated: ProposalLifecycle = {
    ...existing,
    state: toState,
    failure_reason: failureReason,
    updated_at: nowIso,
    state_history: [
      ...existing.state_history,
      {
        from_state: "executing",
        to_state: toState,
        transitioned_at: nowIso,
        reason: failureReason,
      },
    ],
  };

  const saved = repo.save(updated);
  const warnings: string[] = [];
  if (toState === "rolled_back") {
    warnings.push(
      "Lifecycle transitioned to 'rolled_back' — ensure rollback steps are independently verified.",
    );
  }
  return { ok: true, lifecycle: saved, warnings };
}
