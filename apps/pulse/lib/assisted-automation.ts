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
