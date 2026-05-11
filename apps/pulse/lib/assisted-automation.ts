import { createHash } from "crypto";
import { z } from "zod";

const AUTOMATION_ACTION_TYPES = [
  "ack",
  "assign",
  "open_remediation_task",
  "propose_guardrail",
  "rollback",
] as const;

const AUTOMATION_TARGET_TYPES = ["incident", "deployment", "trace_group", "guardrail_policy"] as const;

const evidenceRefSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const automationEligibilityRequestSchema = z.object({
  proposal_id: z.string().min(1),
  action_type: z.enum(AUTOMATION_ACTION_TYPES),
  target_type: z.enum(AUTOMATION_TARGET_TYPES),
  target_id: z.string().min(1),
  request_context: z.object({
    organization_id: z.string().min(1),
    project_id: z.string().min(1).nullable(),
    environment_id: z.string().min(1),
  }),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  signal_quality: z.object({
    confidence: z.enum(["insufficient", "low", "medium", "high"]),
    evidence_density: z.enum(["low", "medium", "high"]),
  }),
  safety: z.object({
    has_rollback_path: z.boolean(),
    has_safe_noop_fallback: z.boolean(),
    policy_checks_passed: z.boolean(),
    high_risk_environment: z.boolean(),
  }),
  approvals: z.object({
    rbac_allows_approval: z.boolean(),
    dual_approval_required: z.boolean(),
  }),
});

export type AutomationEligibilityRequest = z.infer<typeof automationEligibilityRequestSchema>;

export type AutomationEligibility = {
  eligible: boolean;
  reason_codes: string[];
  required_approvals: number;
  requires_operator_review: true;
};

export type AutomationEligibilityGuardResult =
  | {
      ok: true;
      request: AutomationEligibilityRequest;
      eligibility: AutomationEligibility;
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

const isSafeInternalHref = (href: string): boolean => href.startsWith("/") && !href.startsWith("//");

export function validateAutomationEligibility(payload: unknown): AutomationEligibilityGuardResult {
  const parsed = automationEligibilityRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const reasonCodes: string[] = [];

  for (const ref of request.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  if (request.signal_quality.confidence === "insufficient") {
    reasonCodes.push("insufficient_confidence");
  }
  if (request.signal_quality.evidence_density === "low") {
    reasonCodes.push("insufficient_evidence_density");
  }
  if (!request.safety.has_rollback_path && !request.safety.has_safe_noop_fallback) {
    reasonCodes.push("missing_reversibility_or_noop");
  }
  if (!request.approvals.rbac_allows_approval) {
    reasonCodes.push("rbac_denied");
  }
  if (!request.safety.policy_checks_passed) {
    reasonCodes.push("policy_checks_failed");
  }

  const requiredApprovals = request.approvals.dual_approval_required || request.safety.high_risk_environment ? 2 : 1;
  if (requiredApprovals > 1) {
    warnings.push("dual approval required for this automation proposal.");
  }

  return {
    ok: true,
    request,
    eligibility: {
      eligible: reasonCodes.length === 0,
      reason_codes: reasonCodes,
      required_approvals: requiredApprovals,
      requires_operator_review: true,
    },
    warnings,
  };
}

// ── Phase 9.2: Incident Suggestion ───────────────────────────────────────────

const INCIDENT_SEVERITY = ["critical", "high", "medium", "low"] as const;
const INCIDENT_STATUS = ["open", "acknowledged", "resolved"] as const;
const SIGNAL_CONFIDENCE = ["insufficient", "low", "medium", "high"] as const;
const SIGNAL_DENSITY = ["low", "medium", "high"] as const;

const incidentSuggestionRequestSchema = z.object({
  incident_id: z.string().min(1),
  severity: z.enum(INCIDENT_SEVERITY),
  status: z.enum(INCIDENT_STATUS),
  incident_type: z.string().optional(),
  project_name: z.string().optional(),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  available_operators: z.array(z.string().min(1)),
  signal_quality: z.object({
    confidence: z.enum(SIGNAL_CONFIDENCE),
    evidence_density: z.enum(SIGNAL_DENSITY),
  }),
});

export type IncidentSuggestionRequest = z.infer<typeof incidentSuggestionRequestSchema>;

export type IncidentSuggestionConfidence = (typeof SIGNAL_CONFIDENCE)[number];

export type IncidentSuggestion = {
  proposal_id: string;
  draft_note: {
    content: string;
    evidence_refs: Array<{ label: string; href: string }>;
    confidence: IncidentSuggestionConfidence;
    requires_operator_review: true;
  };
  assignee_candidates: Array<{
    operator_email: string;
    rationale: string;
    rank: number;
  }>;
  escalation_recommendation: {
    recommended: boolean;
    rationale: string;
    confidence: IncidentSuggestionConfidence;
    requires_operator_review: true;
  };
  warnings: string[];
};

export type IncidentSuggestionResult =
  | { ok: true; suggestion: IncidentSuggestion }
  | { ok: false; errors: string[]; warnings: string[] };

function deterministicProposalId(incidentId: string, severity: string, status: string): string {
  const hash = createHash("sha256")
    .update(`${incidentId}:${severity}:${status}`)
    .digest("hex")
    .slice(0, 16);
  return `phase9-inc-${hash}`;
}

function buildDraftNote(req: IncidentSuggestionRequest): IncidentSuggestion["draft_note"] {
  const incidentType = req.incident_type ?? "reliability";
  const project = req.project_name ?? "the affected project";
  const lines: string[] = [
    `Investigating ${req.severity} ${incidentType} incident in ${project}.`,
    `Current status: ${req.status}.`,
  ];
  if (req.evidence_refs.length > 0) {
    lines.push(`Evidence reviewed: ${req.evidence_refs.map((r) => r.label).join(", ")}.`);
  }
  lines.push("Requires operator review before any action is taken.");
  return {
    content: lines.join(" "),
    evidence_refs: req.evidence_refs.map((r) => ({ label: r.label, href: r.href })),
    confidence: req.signal_quality.confidence,
    requires_operator_review: true,
  };
}

function rankCandidates(
  operators: string[],
  severity: IncidentSuggestionRequest["severity"],
): IncidentSuggestion["assignee_candidates"] {
  if (operators.length === 0) return [];
  const severityRationale: Record<IncidentSuggestionRequest["severity"], string> = {
    critical: "Critical severity — prioritise on-call or senior operator.",
    high: "High severity — assign to available senior operator.",
    medium: "Medium severity — assign to available operator.",
    low: "Low severity — assign to any available operator.",
  };
  return operators.map((email, index) => ({
    operator_email: email,
    rationale: severityRationale[severity],
    rank: index + 1,
  }));
}

function buildEscalationRecommendation(
  req: IncidentSuggestionRequest,
): IncidentSuggestion["escalation_recommendation"] {
  const { severity, signal_quality } = req;
  const lowSignal =
    signal_quality.confidence === "insufficient" || signal_quality.confidence === "low";
  const recommended = severity === "critical" || (severity === "high" && lowSignal);
  const rationale = recommended
    ? `Escalation recommended: ${severity} severity${lowSignal ? " with low signal quality" : ""}.`
    : `Escalation not required: ${severity} severity with ${signal_quality.confidence} confidence.`;
  return {
    recommended,
    rationale,
    confidence: signal_quality.confidence,
    requires_operator_review: true,
  };
}

export function buildIncidentSuggestions(payload: unknown): IncidentSuggestionResult {
  const parsed = incidentSuggestionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const req = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ref of req.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  if (req.signal_quality.confidence === "insufficient") {
    warnings.push("Signal quality is insufficient — suggestion confidence is low.");
  }
  if (req.available_operators.length === 0) {
    warnings.push("No available operators provided — assignee_candidates list is empty.");
  }

  return {
    ok: true,
    suggestion: {
      proposal_id: deterministicProposalId(req.incident_id, req.severity, req.status),
      draft_note: buildDraftNote(req),
      assignee_candidates: rankCandidates(req.available_operators, req.severity),
      escalation_recommendation: buildEscalationRecommendation(req),
      warnings,
    },
  };
}

// ── Phase 9.2: Suggestion Review ─────────────────────────────────────────────

const incidentSuggestionReviewSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().optional(),
  operator_email: z.string().min(1).optional(),
});

export type IncidentSuggestionReview = z.infer<typeof incidentSuggestionReviewSchema>;

export type IncidentSuggestionReviewResult =
  | {
      ok: true;
      data: { proposal_id: string; review_status: "accepted" | "rejected"; logged: true };
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateIncidentSuggestionReview(
  proposalId: string,
  payload: unknown,
): IncidentSuggestionReviewResult {
  if (!proposalId || !/^phase9-inc-[0-9a-f]{16}$/.test(proposalId)) {
    return { ok: false, errors: ["proposal_id format invalid — must be a phase9-inc-* identifier."], warnings: [] };
  }

  const parsed = incidentSuggestionReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (parsed.data.decision === "rejected" && !parsed.data.reason) {
    warnings.push("Rejection reason not provided — future policy tuning will be limited.");
  }

  return {
    ok: true,
    data: { proposal_id: proposalId, review_status: parsed.data.decision, logged: true },
    warnings,
  };
}

// ── Phase 9.3: Remediation Staging ───────────────────────────────────────────
// Validation-only. No persistence, no approval workflow, no execution, no remediation mutation.

const REMEDIATION_STEP_TYPES = [
  "rollback_candidate_command_set",
  "guardrail_update_proposal",
  "remediation_task_draft",
] as const;

export type RemediationStepType = (typeof REMEDIATION_STEP_TYPES)[number];

const STAGING_TTL_MS = 15 * 60 * 1000; // 15 minutes

const remediationStagingRequestSchema = z.object({
  step_type: z.enum(REMEDIATION_STEP_TYPES),
  target_id: z.string().min(1),
  staged_at: z.string().datetime({ message: "staged_at must be an ISO 8601 datetime string" }),
  staged_environment_id: z.string().min(1),
  active_environment_id: z.string().min(1),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  staging_metadata: z.object({
    expected_effect: z.string().min(1),
    reversibility_note: z.string().min(1),
    risk_flags: z.array(z.string()),
    approval_requirements: z.array(z.string()),
  }),
});

export type RemediationStagingRequest = z.infer<typeof remediationStagingRequestSchema>;

export type StagedRemediationStep = {
  step_type: RemediationStepType;
  target_id: string;
  staged_at: string;
  expires_at: string;
  staged_environment_id: string;
  evidence_refs: Array<{ label: string; href: string }>;
  staging_metadata: RemediationStagingRequest["staging_metadata"];
  warnings: string[];
};

export type RemediationStagingResult =
  | { ok: true; staged_step: StagedRemediationStep; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export function stageRemediationStep(
  payload: unknown,
  now: Date = new Date(),
): RemediationStagingResult {
  const parsed = remediationStagingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const req = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  // TTL check
  const stagedAt = new Date(req.staged_at);
  if (now.getTime() - stagedAt.getTime() >= STAGING_TTL_MS) {
    errors.push(
      `staged_at is expired — staged steps must be validated within ${STAGING_TTL_MS / 60000} minutes of staging.`,
    );
  }

  // Environment mismatch check
  if (req.staged_environment_id !== req.active_environment_id) {
    errors.push(
      `environment mismatch — staged_environment_id '${req.staged_environment_id}' does not match active_environment_id '${req.active_environment_id}'.`,
    );
  }

  // Evidence href safety
  for (const ref of req.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  if (req.staging_metadata.risk_flags.length > 0) {
    warnings.push(
      `Staged step has ${req.staging_metadata.risk_flags.length} risk flag(s): ${req.staging_metadata.risk_flags.join(", ")}.`,
    );
  }
  if (req.staging_metadata.approval_requirements.length > 0) {
    warnings.push(
      `Staged step requires approval from: ${req.staging_metadata.approval_requirements.join(", ")}.`,
    );
  }

  const expiresAt = new Date(stagedAt.getTime() + STAGING_TTL_MS).toISOString();

  return {
    ok: true,
    staged_step: {
      step_type: req.step_type,
      target_id: req.target_id,
      staged_at: req.staged_at,
      expires_at: expiresAt,
      staged_environment_id: req.staged_environment_id,
      evidence_refs: req.evidence_refs.map((r) => ({ label: r.label, href: r.href })),
      staging_metadata: req.staging_metadata,
      warnings,
    },
    warnings,
  };
}

// ── Phase 9.4: Auditability and Kill-Switch ───────────────────────────────────
// Validation-only. No persistence, no kill-switch execution, no dashboard wiring.

const AUTOMATION_SURFACES = ["incidents", "deployments", "guardrails"] as const;
export type AutomationSurface = (typeof AUTOMATION_SURFACES)[number];

// ── Audit event validation ────────────────────────────────────────────────────

const auditEventSchema = z.object({
  event_id: z.string().min(1),
  actor: z.object({
    type: z.enum(["human", "system"]),
    id: z.string().min(1),
  }),
  suggestion_generated: z.object({
    proposal_id: z.string().min(1),
    step_type: z.string().min(1),
    surface: z.enum(AUTOMATION_SURFACES),
  }),
  evidence_basis: z.array(evidenceRefSchema).min(1),
  operator_decision: z.object({
    decision: z.enum(["accepted", "rejected", "deferred", "disabled_by_policy"]),
    reason: z.string().optional(),
  }),
  outcome_status: z.enum(["completed", "failed", "cancelled", "disabled_by_policy"]),
  timestamps: z.object({
    proposed_at: z.string().datetime(),
    decided_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
  }),
});

export type AutomationAuditEvent = z.infer<typeof auditEventSchema>;

export type AutomationAuditEventResult =
  | { ok: true; event: AutomationAuditEvent; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateAutomationAuditEvent(payload: unknown): AutomationAuditEventResult {
  const parsed = auditEventSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const event = parsed.data;
  const warnings: string[] = [];

  for (const ref of event.evidence_basis) {
    if (!isSafeInternalHref(ref.href)) {
      return {
        ok: false,
        errors: [`evidence_basis contains non-internal href '${ref.href}'.`],
        warnings: [],
      };
    }
  }

  const proposedMs = new Date(event.timestamps.proposed_at).getTime();
  const decidedMs = new Date(event.timestamps.decided_at).getTime();
  if (decidedMs < proposedMs) {
    return {
      ok: false,
      errors: ["timestamps.decided_at must not precede timestamps.proposed_at."],
      warnings: [],
    };
  }

  if (event.operator_decision.decision === "rejected" && !event.operator_decision.reason) {
    warnings.push("Operator rejection reason not provided — audit record completeness is reduced.");
  }

  return { ok: true, event, warnings };
}

// ── Kill-switch policy validation ─────────────────────────────────────────────

const killSwitchPolicySchema = z.object({
  organization_id: z.string().min(1),
  global_kill_switch_active: z.boolean(),
  surface_kill_switches: z.object({
    incidents: z.boolean(),
    deployments: z.boolean(),
    guardrails: z.boolean(),
  }),
  target_surface: z.enum(AUTOMATION_SURFACES),
  staged_proposal_ids: z.array(z.string()).default([]),
});

export type KillSwitchPolicy = z.infer<typeof killSwitchPolicySchema>;

export type KillSwitchPolicyResult =
  | {
      ok: true;
      allowed: boolean;
      block_reason: string | null;
      disabled_proposal_ids: string[];
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateKillSwitchPolicy(payload: unknown): KillSwitchPolicyResult {
  const parsed = killSwitchPolicySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const policy = parsed.data;
  const warnings: string[] = [];
  let blockReason: string | null = null;

  if (policy.global_kill_switch_active) {
    blockReason = "global kill-switch is active — all automation proposals are blocked.";
  } else if (policy.surface_kill_switches[policy.target_surface]) {
    blockReason = `surface kill-switch is active for '${policy.target_surface}' — automation proposals on this surface are blocked.`;
  }

  const disabledProposalIds =
    blockReason !== null && policy.staged_proposal_ids.length > 0
      ? [...policy.staged_proposal_ids]
      : [];

  if (disabledProposalIds.length > 0) {
    warnings.push(
      `${disabledProposalIds.length} staged proposal(s) marked disabled_by_policy: ${disabledProposalIds.join(", ")}.`,
    );
  }

  return {
    ok: true,
    allowed: blockReason === null,
    block_reason: blockReason,
    disabled_proposal_ids: disabledProposalIds,
    warnings,
  };
}

// ── Observability payload validation ─────────────────────────────────────────

const observabilityPayloadSchema = z.object({
  organization_id: z.string().min(1),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  decision_outcomes: z.object({
    accepted: z.number().int().min(0),
    rejected: z.number().int().min(0),
    deferred: z.number().int().min(0),
    disabled_by_policy: z.number().int().min(0),
  }),
  block_reason_distribution: z.array(
    z.object({
      reason: z.string().min(1),
      count: z.number().int().min(0),
    }),
  ),
  operator_override_frequency: z.number().min(0).max(1),
});

export type ObservabilityPayload = z.infer<typeof observabilityPayloadSchema>;

export type ObservabilityPayloadResult =
  | { ok: true; payload: ObservabilityPayload; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateObservabilityPayload(payload: unknown): ObservabilityPayloadResult {
  const parsed = observabilityPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const data = parsed.data;
  const warnings: string[] = [];

  if (new Date(data.window_end).getTime() <= new Date(data.window_start).getTime()) {
    return {
      ok: false,
      errors: ["window_end must be after window_start."],
      warnings: [],
    };
  }

  const total =
    data.decision_outcomes.accepted +
    data.decision_outcomes.rejected +
    data.decision_outcomes.deferred +
    data.decision_outcomes.disabled_by_policy;

  if (total === 0) {
    warnings.push("No automation decisions recorded in this window.");
  }

  if (data.operator_override_frequency > 0.5) {
    warnings.push(
      `High operator override frequency (${(data.operator_override_frequency * 100).toFixed(1)}%) — review automation policy tuning.`,
    );
  }

  return { ok: true, payload: data, warnings };
}

// ── Phase 9.5: Remediation Proposal Completion ───────────────────────────────
// Validation-only. No execution, no persistence, no task creation.

const BLAST_RADIUS_SCOPES = ["environment", "project", "organization"] as const;
const RISK_LEVELS = ["low", "medium", "high"] as const;
const REVERSIBILITY_STATUSES = ["reversible", "irreversible", "partially_reversible"] as const;
const POLICY_RESULTS = ["passed", "denied"] as const;

type BlastRadiusScope = (typeof BLAST_RADIUS_SCOPES)[number];
type RiskLevel = (typeof RISK_LEVELS)[number];

// ── Impact Preview ────────────────────────────────────────────────────────────

const impactPreviewRequestSchema = z.object({
  proposal_id: z.string().regex(/^phase9-[a-z]+-[0-9a-f]{16}$/, "proposal_id format invalid"),
  action_type: z.enum(AUTOMATION_ACTION_TYPES),
  target_type: z.enum(AUTOMATION_TARGET_TYPES),
  target_id: z.string().min(1),
  step_type: z.enum(REMEDIATION_STEP_TYPES),
  environment_id: z.string().min(1),
  expected_effect: z.string().min(1),
  reversibility_note: z.string().min(1),
  risk_flags: z.array(z.string()),
  evidence_refs: z.array(evidenceRefSchema).min(1),
});

export type ImpactPreviewRequest = z.infer<typeof impactPreviewRequestSchema>;

export type ImpactPreview = {
  proposal_id: string;
  command_preview: string;
  blast_radius: {
    scope: BlastRadiusScope;
    affected_target: string;
    risk_level: RiskLevel;
  };
  reversibility: {
    reversible: boolean;
    note: string;
  };
  policy_decision_summary: {
    gates_evaluated: string[];
    result: "eligible" | "ineligible";
  };
  evidence_refs: Array<{ label: string; href: string }>;
  requires_operator_review: true;
};

export type ImpactPreviewResult =
  | { ok: true; preview: ImpactPreview; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function blastRadiusScope(targetType: ImpactPreviewRequest["target_type"]): BlastRadiusScope {
  if (targetType === "guardrail_policy") return "organization";
  if (targetType === "trace_group") return "project";
  return "environment";
}

function riskLevel(actionType: ImpactPreviewRequest["action_type"], riskFlags: string[]): RiskLevel {
  if (actionType === "rollback" || riskFlags.length >= 2) return "high";
  if (actionType === "open_remediation_task" || actionType === "propose_guardrail" || riskFlags.length === 1) return "medium";
  return "low";
}

function commandPreview(req: ImpactPreviewRequest): string {
  const actionLabels: Record<ImpactPreviewRequest["action_type"], string> = {
    ack: "Acknowledge",
    assign: "Assign",
    open_remediation_task: "Open remediation task for",
    propose_guardrail: "Propose guardrail update for",
    rollback: "Propose rollback candidate for",
  };
  return `${actionLabels[req.action_type]} ${req.target_type} '${req.target_id}' in environment '${req.environment_id}'. Expected effect: ${req.expected_effect}`;
}

export function buildImpactPreview(payload: unknown): ImpactPreviewResult {
  const parsed = impactPreviewRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const req = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ref of req.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  const level = riskLevel(req.action_type, req.risk_flags);
  const irreversible = /irreversible/i.test(req.reversibility_note);
  const policyGates = [
    "tenant_scope",
    "policy_eligibility",
    "evidence_density",
    "operator_confirmation_required",
    "rollback_path",
    "blast_radius",
  ];

  if (level === "high") {
    warnings.push(`High-risk action '${req.action_type}' — dual operator review recommended.`);
  }
  if (irreversible) {
    warnings.push("Action is irreversible — operator must explicitly acknowledge before confirmation.");
  }

  return {
    ok: true,
    preview: {
      proposal_id: req.proposal_id,
      command_preview: commandPreview(req),
      blast_radius: {
        scope: blastRadiusScope(req.target_type),
        affected_target: req.target_id,
        risk_level: level,
      },
      reversibility: {
        reversible: !irreversible,
        note: req.reversibility_note,
      },
      policy_decision_summary: {
        gates_evaluated: policyGates,
        result: "eligible",
      },
      evidence_refs: req.evidence_refs.map((r) => ({ label: r.label, href: r.href })),
      requires_operator_review: true,
    },
    warnings,
  };
}

// ── Operator Confirmation ─────────────────────────────────────────────────────

const operatorConfirmationSchema = z.object({
  proposal_id: z.string().regex(/^phase9-[a-z]+-[0-9a-f]{16}$/, "proposal_id format invalid"),
  operator_identity: z.object({
    operator_email: z.string().email(),
    operator_id: z.string().min(1),
  }),
  target_summary: z.string().min(1),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  policy_result: z.enum(POLICY_RESULTS),
  reversibility_status: z.enum(REVERSIBILITY_STATUSES),
  confirmation_acknowledged: z.boolean(),
  proposal_expires_at: z.string().datetime(),
  confirmed_at: z.string().datetime(),
});

export type OperatorConfirmationRequest = z.infer<typeof operatorConfirmationSchema>;

export type OperatorConfirmationResult =
  | {
      ok: true;
      data: {
        proposal_id: string;
        operator_email: string;
        confirmation_status: "confirmed";
        reversibility_status: string;
        logged: true;
      };
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateOperatorConfirmation(payload: unknown): OperatorConfirmationResult {
  const parsed = operatorConfirmationSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const req = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!req.confirmation_acknowledged) {
    errors.push("confirmation_acknowledged must be true — implicit approval is not permitted.");
  }

  if (new Date(req.confirmed_at).getTime() >= new Date(req.proposal_expires_at).getTime()) {
    errors.push("proposal has expired — revalidate the proposal before confirming.");
  }

  if (req.policy_result === "denied") {
    errors.push("policy_result is 'denied' — operator cannot confirm a policy-denied proposal.");
  }

  for (const ref of req.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  if (req.reversibility_status === "irreversible") {
    warnings.push("Confirmed irreversible action — ensure evidence receipt is emitted immediately.");
  }
  if (req.reversibility_status === "partially_reversible") {
    warnings.push("Action is partially reversible — document which steps cannot be undone.");
  }

  return {
    ok: true,
    data: {
      proposal_id: req.proposal_id,
      operator_email: req.operator_identity.operator_email,
      confirmation_status: "confirmed",
      reversibility_status: req.reversibility_status,
      logged: true,
    },
    warnings,
  };
}

// ── Evidence Receipt ──────────────────────────────────────────────────────────

const evidenceReceiptRequestSchema = z.object({
  proposal_id: z.string().min(1),
  actor_id: z.string().min(1),
  action_class: z.enum(AUTOMATION_ACTION_TYPES),
  target: z.object({
    target_type: z.enum(AUTOMATION_TARGET_TYPES),
    target_id: z.string().min(1),
  }),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  policy_gate_result: z.enum(POLICY_RESULTS),
  created_at: z.string().datetime(),
});

export type EvidenceReceiptRequest = z.infer<typeof evidenceReceiptRequestSchema>;

export type EvidenceReceipt = {
  receipt_id: string;
  proposal_id: string;
  actor_id: string;
  action_class: string;
  target: { target_type: string; target_id: string };
  evidence_refs: Array<{ label: string; href: string }>;
  policy_gate_result: "passed" | "denied";
  created_at: string;
  immutable: true;
};

export type EvidenceReceiptResult =
  | { ok: true; receipt: EvidenceReceipt; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function deterministicReceiptId(proposalId: string, actorId: string, createdAt: string): string {
  const hash = createHash("sha256")
    .update(`${proposalId}:${actorId}:${createdAt}`)
    .digest("hex")
    .slice(0, 16);
  return `receipt-${hash}`;
}

export function emitEvidenceReceipt(payload: unknown): EvidenceReceiptResult {
  const parsed = evidenceReceiptRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`),
      warnings: [],
    };
  }

  const req = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const ref of req.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  if (new Date(req.created_at).getTime() > Date.now() + 5000) {
    warnings.push("created_at is in the future — verify timestamp source.");
  }
  if (req.policy_gate_result === "denied") {
    warnings.push("Evidence receipt issued for a policy-denied proposal — this records the denial, not an approval.");
  }

  return {
    ok: true,
    receipt: {
      receipt_id: deterministicReceiptId(req.proposal_id, req.actor_id, req.created_at),
      proposal_id: req.proposal_id,
      actor_id: req.actor_id,
      action_class: req.action_class,
      target: { target_type: req.target.target_type, target_id: req.target.target_id },
      evidence_refs: req.evidence_refs.map((r) => ({ label: r.label, href: r.href })),
      policy_gate_result: req.policy_gate_result,
      created_at: req.created_at,
      immutable: true,
    },
    warnings,
  };
}
