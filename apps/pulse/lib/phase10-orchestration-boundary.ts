/**
 * Phase 10 — Orchestration Boundary Contract
 *
 * This file is SPECIFICATION ONLY. It defines the typed interface contract for
 * every stage in the assisted-automation pipeline. No stage is implemented here.
 * No runtime behavior executes. No imports from other lib/ files.
 *
 * Phase 11 wires concrete implementations against these interfaces:
 *
 *   const orchestration: Phase10OrchestrationBoundary = {
 *     invariants: PHASE10_ORCHESTRATION_INVARIANTS,
 *     stages: {
 *       detector:            new IncidentFeedDetector(),
 *       policy_engine:       new Phase9PolicyEngine(),
 *       proposal_engine:     new Phase9ProposalEngine(),
 *       execution_planner:   new LifecycleStagingPlanner(),
 *       staging_executor:    new ControlledExecutionStager(),
 *       verification_engine: new Phase10VerificationEngine(),
 *       audit_ledger:        new OperationsTimelineLedger(),
 *     },
 *     stage_order: PIPELINE_STAGE_ORDER,
 *   };
 *
 * Current Phase 10 implementations that satisfy each stage:
 *
 *   detector            → (not yet a named stage — signals enter via incident feed)
 *   policy_engine       → lib/assisted-automation.ts :: validateAutomationEligibility
 *   proposal_engine     → lib/assisted-automation.ts :: suggestAutomationActions + validateOperatorConfirmation
 *   execution_planner   → lib/proposal-lifecycle.ts  :: transitionLifecycle → "staged"
 *   staging_executor    → lib/controlled-execution.ts :: validateControlledExecution
 *   verification_engine → lib/verification-engine.ts :: runVerification
 *   audit_ledger        → lib/operations-timeline.ts :: InMemoryOperationsTimelineRepository
 *
 * See docs/adr/phase10-orchestration-boundary.md for rationale.
 */

// ── Shared primitive types ────────────────────────────────────────────────────
// Defined inline to keep this file self-contained. Phase 11 may alias these to
// shared schema types once a common type package exists.

export type Severity = "critical" | "high" | "medium" | "low";
export type SignalConfidence = "insufficient" | "low" | "medium" | "high";
export type EvidenceDensity = "low" | "medium" | "high";
export type ActorType = "human" | "system";
export type BlastRadiusScope = "environment" | "project" | "organization";

export type EvidenceRef = {
  readonly label: string;
  readonly href: string;  // internal path only; validated at write time
};

// Action and target types define what the pipeline can operate on.
// Defined here independently of lib/controlled-execution.ts so the boundary
// remains decoupled from Phase 10's current implementation.

export const PIPELINE_ACTION_TYPES = [
  "ack",
  "assign",
  "open_remediation_task",
  "propose_guardrail",
  "rollback",
] as const;
export type PipelineActionType = (typeof PIPELINE_ACTION_TYPES)[number];

export const PIPELINE_TARGET_TYPES = [
  "incident",
  "deployment",
  "trace_group",
  "guardrail_policy",
] as const;
export type PipelineTargetType = (typeof PIPELINE_TARGET_TYPES)[number];

// ── Pipeline envelope ─────────────────────────────────────────────────────────
// Every message passing between stages carries these fields.
// execution_granted: false is a TypeScript literal — it cannot be widened to boolean.
// requires_operator_review: true is a TypeScript literal — it cannot be widened.

export type PipelineEnvelopeBase = {
  readonly event_id: string;                  // "evt-" + sha256 prefix
  readonly occurred_at: string;              // ISO 8601
  readonly organization_id: string;
  readonly proposal_id: string | null;       // "phase9-*" format when set
  readonly lifecycle_id: string | null;      // "lifecycle-*" format when set
  readonly execution_granted: false;         // INVARIANT — never true in Phase 10
  readonly requires_operator_review: true;   // INVARIANT — always true
};

export type StageInput<TPayload> = PipelineEnvelopeBase & {
  readonly stage: string;
  readonly payload: TPayload;
};

export type StageOutput<TOk, TErr = { readonly reason: string; readonly detail: string }> =
  | (PipelineEnvelopeBase & {
      readonly stage: string;
      readonly ok: true;
      readonly result: TOk;
      readonly warnings: string[];
    })
  | (PipelineEnvelopeBase & {
      readonly stage: string;
      readonly ok: false;
      readonly errors: string[];
      readonly error_detail: TErr;
      readonly warnings: string[];
    });

// ── Stage contract interface ───────────────────────────────────────────────────
// Phase 11 creates classes that implement this interface.
// execute() is async to accommodate DB-backed Phase 11 implementations.

export interface PipelineStageContract<
  TPayload,
  TOk,
  TErr = { readonly reason: string; readonly detail: string },
> {
  readonly stage_name: string;
  readonly description: string;
  readonly requires_preceding_stage: string | null;
  readonly actor_type: ActorType;
  execute(input: StageInput<TPayload>): Promise<StageOutput<TOk, TErr>>;
}

// ── Stage 1: Detector ─────────────────────────────────────────────────────────
// Receives a raw reliability signal and emits a structured detection result.
// Phase 10: signals enter via the incident feed; no named detector stage exists.
// Phase 11: wires to the trace pipeline event stream.

export type DetectorInputPayload = {
  readonly signal_source: "trace_pipeline" | "incident_feed" | "regression_engine" | "manual";
  readonly signal_type:   "error_rate_spike" | "latency_regression" | "volume_anomaly" | "manual_report";
  readonly target_type:   PipelineTargetType;
  readonly target_id:     string;
  readonly raw_metric_snapshot: {
    readonly error_rate_pct:   number;
    readonly p99_latency_ms:   number;
    readonly request_count:    number;
    readonly window_start:     string; // ISO 8601
    readonly window_end:       string;
  };
};

export type DetectorOk = {
  readonly detection_id:  string;   // "det-" + sha256 prefix
  readonly incident_id:   string | null;
  readonly severity:      Severity;
  readonly signal_quality: {
    readonly confidence:      SignalConfidence;
    readonly evidence_density: EvidenceDensity;
  };
  readonly evidence_refs: ReadonlyArray<EvidenceRef>;
};

export type DetectorErr = {
  readonly reason:  "insufficient_signal" | "duplicate_detection" | "below_threshold";
  readonly detail:  string;
};

// ── Stage 2: Policy Engine ────────────────────────────────────────────────────
// Evaluates automation eligibility. Enforces blast radius, kill switches, and
// confidence thresholds. Phase 10: lib/assisted-automation.ts ::
// validateAutomationEligibility.

export type PolicyEngineInputPayload = {
  readonly detection_id:        string;
  readonly proposed_action_type: PipelineActionType;
  readonly target_type:         PipelineTargetType;
  readonly target_id:           string;
  readonly signal_quality:      DetectorOk["signal_quality"];
  readonly blast_radius: {
    readonly estimated_scope:   BlastRadiusScope;
    readonly max_allowed_scope: BlastRadiusScope;
  };
  readonly safety: {
    readonly has_rollback_path:       boolean;
    readonly has_safe_noop_fallback:  boolean;
    readonly high_risk_environment:   boolean;
    readonly policy_checks_passed:    boolean;
  };
  readonly approvals: {
    readonly rbac_allows_approval:   boolean;
    readonly dual_approval_required: boolean;
  };
};

export type PolicyEngineOk = {
  readonly gate_id:     string;   // "gate-" + sha256 prefix
  readonly eligible:    true;
  readonly reason_codes: readonly string[];
};

export type PolicyEngineErr = {
  readonly reason:
    | "blast_radius_exceeded"
    | "policy_rule_blocked"
    | "kill_switch_active"
    | "insufficient_confidence"
    | "rbac_insufficient";
  readonly detail:       string;
  readonly reason_codes: readonly string[];
};

// ── Stage 3: Proposal Engine ──────────────────────────────────────────────────
// Generates the automation proposal and creates the Phase 10.1 lifecycle.
// Phase 10: lib/assisted-automation.ts :: suggestAutomationActions +
// validateOperatorConfirmation.

export type ProposalEngineInputPayload = {
  readonly gate_id:       string;
  readonly detection_id:  string;
  readonly action_type:   PipelineActionType;
  readonly target_type:   PipelineTargetType;
  readonly target_id:     string;
  readonly evidence_refs: ReadonlyArray<EvidenceRef>;
};

export type ProposalEngineOk = {
  readonly proposal_id:         string;   // "phase9-*" format
  readonly lifecycle_id:        string;   // "lifecycle-*" format
  readonly action_type:         PipelineActionType;
  readonly staged_plan_summary: string;   // human-readable; NOT executable code
  readonly expires_at:          string;   // ISO 8601
};

// ── Stage 4: Execution Planner ────────────────────────────────────────────────
// Builds an operator-reviewable execution plan from the proposal. Transitions
// the lifecycle to "staged". Phase 10: lib/proposal-lifecycle.ts ::
// transitionLifecycle → "staged".

export type ExecutionPlannerInputPayload = {
  readonly lifecycle_id:    string;
  readonly proposal_id:     string;
  readonly operator_email:  string;
  readonly operator_role:   string;
};

export type ExecutionPlannerOk = {
  readonly plan_id:       string;   // "plan-" + sha256 prefix
  readonly lifecycle_state: "staged";
  readonly execution_steps: ReadonlyArray<{
    readonly step_id:                 string;
    readonly action_type:             PipelineActionType;
    readonly target_type:             PipelineTargetType;
    readonly target_id:               string;
    readonly requires_confirmation:   true;     // INVARIANT — every step requires confirmation
    readonly estimated_blast_radius:  BlastRadiusScope;
    readonly step_summary:            string;   // human-readable; NOT executable code
  }>;
  readonly requires_dual_approval: boolean;
  readonly plan_expires_at:        string;
};

// ── Stage 5: Staging Executor ─────────────────────────────────────────────────
// Records operator confirmation and marks the lifecycle as "executing". This
// stage ENTERS the execution boundary — it does not perform production mutations.
// execution_granted: false is enforced in the envelope and at the type level.
// Phase 10: lib/controlled-execution.ts :: validateControlledExecution.

export type StagingExecutorInputPayload = {
  readonly lifecycle_id:         string;
  readonly plan_id:              string;
  readonly operator_email:       string;
  // Phase 11: replace with a signed operator confirmation token from the auth layer.
  readonly confirmation_reference: string;
};

export type StagingExecutorOk = {
  readonly lifecycle_state:     "executing";
  readonly boundary_entered_at: string;           // ISO 8601
  // This assertion is the public record that execution_granted remains false
  // even while the lifecycle is in the "executing" state.
  readonly boundary_assertion:  "operator-confirmed-assisted-automation-only";
};

// ── Stage 6: Verification Engine ─────────────────────────────────────────────
// Classifies the post-execution outcome from metric snapshots. Read-only.
// Phase 10: lib/verification-engine.ts :: runVerification.

export type VerificationEngineInputPayload = {
  readonly lifecycle_id:  string;
  readonly proposal_id:   string;
  readonly before_window: {
    readonly window_start:    string;
    readonly window_end:      string;
    readonly request_count:   number;
    readonly error_rate_pct:  number;
    readonly p99_latency_ms:  number;
    readonly p50_latency_ms:  number;
  };
  readonly after_window: {
    readonly window_start:    string;
    readonly window_end:      string;
    readonly request_count:   number;
    readonly error_rate_pct:  number;
    readonly p99_latency_ms:  number;
    readonly p50_latency_ms:  number;
  };
};

export type VerificationEngineOutcome =
  | "recovered"
  | "partial_recovery"
  | "no_change"
  | "regressed"
  | "verification_failed";

export type VerificationEngineOk = {
  readonly result_id:      string;   // "vr-" + sha256 prefix
  readonly outcome:        VerificationEngineOutcome;
  readonly confidence:     "low" | "medium" | "high";
  readonly rationale:      string;
  readonly lifecycle_state: "verified" | "failed";
};

// ── Stage 7: Audit Ledger ─────────────────────────────────────────────────────
// Records every pipeline event as an immutable operations timeline entry and
// emits evidence receipts on approval. Phase 10: lib/operations-timeline.ts ::
// InMemoryOperationsTimelineRepository.

export type AuditLedgerInputPayload = {
  readonly source_stage:      string;
  readonly lifecycle_id:      string | null;
  readonly proposal_id:       string | null;
  // OperationsTimelineEventKind value — not imported to keep this file standalone.
  readonly event_kind:        string;
  readonly actor_type:        ActorType;
  readonly actor_label:       string;
  readonly title:             string;
  readonly summary:           string;
  readonly policy_gate_result: "passed" | "denied" | null;
  readonly evidence_refs:     ReadonlyArray<EvidenceRef>;
};

export type AuditLedgerOk = {
  readonly entry_id:       string;   // "otl-" + sha256 prefix
  readonly ledger_state:   "recorded";
  readonly receipt_emitted: boolean;
  readonly receipt_id:     string | null;  // set when lifecycle is in "approved" state
};

// ── Phase10OrchestrationBoundary type ─────────────────────────────────────────
// The full pipeline contract. Phase 11 creates a value that satisfies this type.
//
// Usage (Phase 11):
//   import type { Phase10OrchestrationBoundary } from "@/lib/phase10-orchestration-boundary";
//   const pipeline = { ... } satisfies Phase10OrchestrationBoundary;

export type Phase10OrchestrationBoundary = {
  readonly invariants: {
    readonly execution_granted:        false;
    readonly requires_operator_review: true;
    readonly autonomy_level:           "assisted-only";
    readonly boundary_statement:       string;
    readonly phase:                    "10";
  };
  readonly stages: {
    readonly detector:            PipelineStageContract<DetectorInputPayload,           DetectorOk,          DetectorErr>;
    readonly policy_engine:       PipelineStageContract<PolicyEngineInputPayload,       PolicyEngineOk,      PolicyEngineErr>;
    readonly proposal_engine:     PipelineStageContract<ProposalEngineInputPayload,     ProposalEngineOk>;
    readonly execution_planner:   PipelineStageContract<ExecutionPlannerInputPayload,   ExecutionPlannerOk>;
    readonly staging_executor:    PipelineStageContract<StagingExecutorInputPayload,    StagingExecutorOk>;
    readonly verification_engine: PipelineStageContract<VerificationEngineInputPayload, VerificationEngineOk>;
    readonly audit_ledger:        PipelineStageContract<AuditLedgerInputPayload,        AuditLedgerOk>;
  };
  readonly stage_order: ReadonlyArray<keyof Phase10OrchestrationBoundary["stages"]>;
};

// ── Exported constants ────────────────────────────────────────────────────────

/**
 * Governance invariants enforced across the entire pipeline.
 * These are not configurable — they are structural properties of Phase 10.
 */
export const PHASE10_ORCHESTRATION_INVARIANTS = {
  execution_granted:        false,
  requires_operator_review: true,
  autonomy_level:           "assisted-only",
  boundary_statement:
    "Assisted automation only. All proposals require operator confirmation. " +
    "execution_granted: false — no autonomous production mutations. " +
    "Phase 9 policy gates enforced on every proposal.",
  phase: "10",
} as const satisfies Phase10OrchestrationBoundary["invariants"];

/**
 * Canonical stage order from signal detection to audit record.
 * Phase 11 enforces this ordering at the orchestration layer.
 */
export const PIPELINE_STAGE_ORDER = [
  "detector",
  "policy_engine",
  "proposal_engine",
  "execution_planner",
  "staging_executor",
  "verification_engine",
  "audit_ledger",
] as const satisfies ReadonlyArray<keyof Phase10OrchestrationBoundary["stages"]>;

/**
 * Maps each pipeline stage to the Phase 10 file that currently implements
 * (or approximates) its contract. Phase 11 replaces these with
 * PipelineStageContract implementations.
 */
export const PHASE10_STAGE_IMPLEMENTATIONS = {
  detector:            null,                              // no named stage yet; signals enter via incident feed
  policy_engine:       "lib/assisted-automation.ts",     // validateAutomationEligibility
  proposal_engine:     "lib/assisted-automation.ts",     // suggestAutomationActions + validateOperatorConfirmation
  execution_planner:   "lib/proposal-lifecycle.ts",      // transitionLifecycle → "staged"
  staging_executor:    "lib/controlled-execution.ts",    // validateControlledExecution
  verification_engine: "lib/verification-engine.ts",     // runVerification
  audit_ledger:        "lib/operations-timeline.ts",     // InMemoryOperationsTimelineRepository
} as const satisfies Record<keyof Phase10OrchestrationBoundary["stages"], string | null>;
