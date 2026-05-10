import { z } from "zod";

export const CONTROLLED_ACTION_TYPES = [
  "ack",
  "assign",
  "open_remediation_task",
  "propose_guardrail",
  "rollback",
] as const;

export const CONTROLLED_TARGET_TYPES = [
  "incident",
  "deployment",
  "trace_group",
  "guardrail_policy",
] as const;

export type ControlledActionType = (typeof CONTROLLED_ACTION_TYPES)[number];
export type ControlledTargetType = (typeof CONTROLLED_TARGET_TYPES)[number];

const executionActionTargetMatrix: Record<ControlledActionType, ControlledTargetType[]> = {
  ack: ["incident"],
  assign: ["incident"],
  open_remediation_task: ["incident", "deployment", "trace_group"],
  propose_guardrail: ["incident", "deployment", "trace_group", "guardrail_policy"],
  rollback: ["deployment"],
};

const evidenceRefSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const controlledExecutionRequestSchema = z.object({
  execution_id: z.string().min(1),
  proposal_id: z.string().min(1),
  action_type: z.enum(CONTROLLED_ACTION_TYPES),
  target_type: z.enum(CONTROLLED_TARGET_TYPES),
  target_id: z.string().min(1),
  approved_by_user_id: z.string().min(1),
  approved_at: z.string().datetime(),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  dry_run_result_id: z.string().min(1).nullable(),
  request_context: z.object({
    organization_id: z.string().min(1),
    project_id: z.string().min(1).nullable(),
    environment_id: z.string().min(1).nullable(),
  }),
});

export type ControlledExecutionRequest = z.infer<typeof controlledExecutionRequestSchema>;

export type ControlledExecutionGuardResult =
  | { ok: true; request: ControlledExecutionRequest; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const executionConfirmationSchema = z.object({
  proposal_id: z.string().min(1),
  approval_state: z.literal("approved"),
  approved_by_user_id: z.string().min(1),
  approved_at: z.string().datetime(),
  confirmation_text: z.literal("CONFIRM"),
  target_summary: z.string().min(1),
  reversibility: z.enum(["reversible", "non_reversible"]),
});

export type ControlledExecutionConfirmationRequest = z.infer<typeof executionConfirmationSchema>;

export type ControlledExecutionConfirmationGuardResult =
  | { ok: true; request: ControlledExecutionConfirmationRequest; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const executionAuditEventSchema = z.object({
  event_id: z.string().min(1),
  execution_id: z.string().min(1),
  proposal_id: z.string().min(1),
  action_type: z.enum(CONTROLLED_ACTION_TYPES),
  actor_user_id: z.string().min(1),
  actor_role: z.string().min(1),
  target_type: z.enum(CONTROLLED_TARGET_TYPES),
  target_id: z.string().min(1),
  reason: z.string().min(1),
  evidence_refs: z.array(evidenceRefSchema).min(1),
  before_state: z.record(z.string(), z.unknown()).nullable(),
  after_state: z.record(z.string(), z.unknown()).nullable(),
  result: z.enum(["succeeded", "failed", "blocked"]),
  error_code: z.string().min(1).nullable(),
  created_at: z.string().datetime(),
});

export type ExecutionAuditEvent = z.infer<typeof executionAuditEventSchema>;

export type ExecutionAuditEventGuardResult =
  | { ok: true; request: ExecutionAuditEvent; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isSafeInternalHref = (href: string): boolean => {
  if (!href.startsWith("/")) {
    return false;
  }
  if (href.startsWith("//")) {
    return false;
  }
  return true;
};

export function validateControlledExecutionRequest(
  payload: unknown,
  now: Date = new Date(),
): ControlledExecutionGuardResult {
  const parsed = controlledExecutionRequestSchema.safeParse(payload);
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

  const allowedTargets = executionActionTargetMatrix[request.action_type];
  if (!allowedTargets.includes(request.target_type)) {
    errors.push(`action_type '${request.action_type}' is not allowed for target_type '${request.target_type}'.`);
  }

  for (const ref of request.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
      continue;
    }
    if (ref.href.startsWith("/pulse/system") || ref.href.startsWith("/system")) {
      warnings.push(`evidence ref '${ref.href}' points to admin intelligence surface.`);
    }
  }

  const approvalTime = new Date(request.approved_at);
  if (Number.isNaN(approvalTime.getTime())) {
    errors.push("approved_at is invalid.");
  } else {
    const maxFutureSkewMs = 5 * 60 * 1000;
    if (approvalTime.getTime() - now.getTime() > maxFutureSkewMs) {
      errors.push("approved_at is too far in the future.");
    }
    const maxApprovalAgeMs = 24 * 60 * 60 * 1000;
    if (now.getTime() - approvalTime.getTime() > maxApprovalAgeMs) {
      warnings.push("approval is older than 24h; re-approval recommended.");
    }
  }

  if (request.action_type === "rollback") {
    if (!request.dry_run_result_id) {
      errors.push("rollback requires dry_run_result_id.");
    }
    if (!request.request_context.environment_id) {
      errors.push("rollback requires request_context.environment_id.");
    }
  }

  if (request.evidence_refs.length < 2) {
    warnings.push("single evidence reference provided; confidence may be insufficient.");
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, request, warnings };
}

export function validateControlledExecutionConfirmation(
  payload: unknown,
  now: Date = new Date(),
): ControlledExecutionConfirmationGuardResult {
  const parsed = executionConfirmationSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const warnings: string[] = [];
  const approvedAt = new Date(request.approved_at);
  const errors: string[] = [];

  if (Number.isNaN(approvedAt.getTime())) {
    errors.push("approved_at is invalid.");
  } else {
    const maxFutureSkewMs = 5 * 60 * 1000;
    if (approvedAt.getTime() - now.getTime() > maxFutureSkewMs) {
      errors.push("approved_at is too far in the future.");
    }
    const maxApprovalAgeMs = 24 * 60 * 60 * 1000;
    if (now.getTime() - approvedAt.getTime() > maxApprovalAgeMs) {
      warnings.push("approval is older than 24h; re-approval recommended.");
    }
  }

  if (request.reversibility === "non_reversible") {
    warnings.push("non-reversible action requires explicit operator caution.");
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, request, warnings };
}

export function validateExecutionAuditEvent(payload: unknown, now: Date = new Date()): ExecutionAuditEventGuardResult {
  const parsed = executionAuditEventSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const warnings: string[] = [];
  const errors: string[] = [];

  const createdAt = new Date(request.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    errors.push("created_at is invalid.");
  } else {
    const maxFutureSkewMs = 5 * 60 * 1000;
    if (createdAt.getTime() - now.getTime() > maxFutureSkewMs) {
      errors.push("created_at is too far in the future.");
    }
  }

  if (request.result === "blocked" && !request.error_code) {
    warnings.push("blocked audit event should include error_code.");
  }
  if (request.result === "failed" && !request.error_code) {
    warnings.push("failed audit event should include error_code.");
  }

  for (const ref of request.evidence_refs) {
    if (!isSafeInternalHref(ref.href)) {
      errors.push(`evidence_refs contains non-internal href '${ref.href}'.`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, request, warnings };
}
