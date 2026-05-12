import { z } from "zod";

const verificationWriteSchema = z.object({
  lifecycle_id: z.string().min(1),
  proposal_id: z.string().min(1),
  verification_result_id: z.string().min(1),
  outcome: z.enum(["passed", "failed", "inconclusive"]),
  verified_at: z.string().datetime(),
  organization_id: z.string().min(1),
  evidence_refs: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).min(1),
  policy_checks: z.object({
    evidence_present: z.boolean(),
    policy_blocked: z.boolean(),
    operator_review_required: z.boolean(),
  }),
});

export type VerificationWriteRequest = z.infer<typeof verificationWriteSchema>;

export type VerificationWriteContractResult =
  | {
      ok: true;
      verification_write_accepted: true;
      response_class: "accepted_validation";
      verification_write_intent: {
        lifecycle_id: string;
        proposal_id: string;
        verification_result_id: string;
        outcome: "passed" | "failed" | "inconclusive";
        execution_granted: false;
        requires_operator_review: true;
      };
      request: VerificationWriteRequest;
      warnings: string[];
    }
  | {
      ok: false;
      verification_write_accepted: false;
      response_class: "rejected_schema" | "rejected_policy" | "rejected_timestamp";
      errors: string[];
      warnings: string[];
    };

export function validateVerificationWriteContract(
  payload: unknown,
  now: Date = new Date(),
): VerificationWriteContractResult {
  const parsed = verificationWriteSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      verification_write_accepted: false,
      response_class: "rejected_schema",
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const verifiedAt = new Date(request.verified_at);
  if (Number.isNaN(verifiedAt.getTime())) {
    errors.push("verified_at is invalid.");
  } else if (verifiedAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    errors.push("verified_at is too far in the future.");
  }

  if (!request.policy_checks.evidence_present) {
    errors.push("evidence is required before verification write intent can be accepted.");
  }
  if (request.policy_checks.policy_blocked) {
    errors.push("verification write intent blocked by policy.");
  }
  if (!request.policy_checks.operator_review_required) {
    warnings.push("operator review should remain required.");
  }
  if (request.outcome === "inconclusive") {
    warnings.push("inconclusive verification outcomes require additional operator follow-up.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      verification_write_accepted: false,
      response_class: errors.some((error) => error.includes("verified_at"))
        ? "rejected_timestamp"
        : "rejected_policy",
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    verification_write_accepted: true,
    response_class: "accepted_validation",
    verification_write_intent: {
      lifecycle_id: request.lifecycle_id,
      proposal_id: request.proposal_id,
      verification_result_id: request.verification_result_id,
      outcome: request.outcome,
      execution_granted: false,
      requires_operator_review: true,
    },
    request,
    warnings,
  };
}
