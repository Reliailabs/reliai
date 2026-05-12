import { createHash } from "crypto";
import { z } from "zod";

const createLifecycleSchema = z.object({
  proposal_id: z.string().min(1),
  action_type: z.string().min(1),
  target_type: z.enum(["incident", "regression", "proposal", "verification", "deployment", "guardrail_policy", "trace_group"]),
  target_id: z.string().min(1),
  organization_id: z.string().min(1),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  evidence_refs: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).min(1),
  policy_checks: z.object({
    evidence_present: z.boolean(),
    policy_blocked: z.boolean(),
    operator_review_required: z.boolean(),
  }),
});

export type LifecycleCreateRequest = z.infer<typeof createLifecycleSchema>;

export type LifecycleCreateContractResult =
  | {
      ok: true;
      create_accepted: true;
      response_class: "accepted_validation";
      lifecycle_preview: {
        lifecycle_id: string;
        state: "detected";
        execution_granted: false;
        requires_operator_review: true;
      };
      immutable_fields: readonly string[];
      request: LifecycleCreateRequest;
      warnings: string[];
    }
  | {
      ok: false;
      create_accepted: false;
      response_class: "rejected_schema" | "rejected_policy" | "rejected_timestamp";
      errors: string[];
      warnings: string[];
    };

export const LIFECYCLE_CREATE_IMMUTABLE_FIELDS = [
  "proposal_id",
  "target_type",
  "target_id",
  "organization_id",
  "created_at",
  "expires_at",
  "evidence_refs",
] as const;

function deterministicLifecycleId(proposalId: string, createdAt: string): string {
  return `lifecycle-${createHash("sha256").update(`${proposalId}:${createdAt}`).digest("hex").slice(0, 16)}`;
}

export function validateLifecycleCreateContract(payload: unknown, now: Date = new Date()): LifecycleCreateContractResult {
  const parsed = createLifecycleSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      create_accepted: false,
      response_class: "rejected_schema",
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const createdAt = new Date(request.created_at);
  const expiresAt = new Date(request.expires_at);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    errors.push("created_at/expires_at are invalid.");
  } else {
    if (expiresAt.getTime() <= createdAt.getTime()) {
      errors.push("expires_at must be after created_at.");
    }
    if (createdAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      errors.push("created_at is too far in the future.");
    }
  }

  if (!request.policy_checks.evidence_present) {
    errors.push("evidence is required before lifecycle creation.");
  }
  if (request.policy_checks.policy_blocked) {
    errors.push("lifecycle creation blocked by policy.");
  }
  if (!request.policy_checks.operator_review_required) {
    warnings.push("operator review should remain required.");
  }

  if (errors.length > 0) {
    const response_class = errors.some((e) => e.includes("created_at") || e.includes("expires_at"))
      ? "rejected_timestamp"
      : "rejected_policy";
    return { ok: false, create_accepted: false, response_class, errors, warnings };
  }

  return {
    ok: true,
    create_accepted: true,
    response_class: "accepted_validation",
    lifecycle_preview: {
      lifecycle_id: deterministicLifecycleId(request.proposal_id, request.created_at),
      state: "detected",
      execution_granted: false,
      requires_operator_review: true,
    },
    immutable_fields: LIFECYCLE_CREATE_IMMUTABLE_FIELDS,
    request,
    warnings,
  };
}
