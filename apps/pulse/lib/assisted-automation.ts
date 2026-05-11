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
