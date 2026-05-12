import { z } from "zod";

import {
  TERMINAL_STATES,
  type ProposalLifecycleState,
  VALID_TRANSITIONS,
} from "./proposal-lifecycle";

const transitionIntentSchema = z.object({
  lifecycle_id: z.string().min(1),
  organization_id: z.string().min(1),
  from_state: z.enum([
    "detected",
    "analyzed",
    "proposed",
    "staged",
    "approved",
    "executing",
    "verified",
    "failed",
    "rolled_back",
    "expired",
  ]),
  to_state: z.enum([
    "detected",
    "analyzed",
    "proposed",
    "staged",
    "approved",
    "executing",
    "verified",
    "failed",
    "rolled_back",
    "expired",
  ]),
  proposed_at: z.string().datetime(),
  reason: z.string().trim().min(1).max(500).nullable().optional(),
  evidence_refs: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).min(1),
  policy_checks: z.object({
    evidence_present: z.boolean(),
    policy_blocked: z.boolean(),
    operator_review_required: z.boolean(),
  }),
});

export type LifecycleTransitionIntentRequest = z.infer<typeof transitionIntentSchema>;

export type LifecycleTransitionIntentResult =
  | {
      ok: true;
      transition_accepted: true;
      response_class: "accepted_validation";
      transition_intent: {
        lifecycle_id: string;
        from_state: ProposalLifecycleState;
        to_state: ProposalLifecycleState;
        execution_granted: false;
        requires_operator_review: true;
      };
      request: LifecycleTransitionIntentRequest;
      warnings: string[];
    }
  | {
      ok: false;
      transition_accepted: false;
      response_class: "rejected_schema" | "rejected_policy" | "rejected_timestamp" | "rejected_transition";
      errors: string[];
      warnings: string[];
    };

function isValidTransition(fromState: ProposalLifecycleState, toState: ProposalLifecycleState): boolean {
  const next = VALID_TRANSITIONS.get(fromState);
  if (!next) return false;
  return next.includes(toState);
}

export function validateLifecycleTransitionIntent(
  payload: unknown,
  now: Date = new Date(),
): LifecycleTransitionIntentResult {
  const parsed = transitionIntentSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      transition_accepted: false,
      response_class: "rejected_schema",
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`),
      warnings: [],
    };
  }

  const request = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const proposedAt = new Date(request.proposed_at);
  if (Number.isNaN(proposedAt.getTime())) {
    errors.push("proposed_at is invalid.");
  } else if (proposedAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    errors.push("proposed_at is too far in the future.");
  }

  if (TERMINAL_STATES.has(request.from_state)) {
    errors.push(`cannot propose transitions from terminal state '${request.from_state}'.`);
  } else if (!isValidTransition(request.from_state, request.to_state)) {
    errors.push(`invalid lifecycle transition '${request.from_state}' -> '${request.to_state}'.`);
  }

  if (!request.policy_checks.evidence_present) {
    errors.push("evidence is required before transition intent can be accepted.");
  }
  if (request.policy_checks.policy_blocked) {
    errors.push("transition intent blocked by policy.");
  }
  if (!request.policy_checks.operator_review_required) {
    warnings.push("operator review should remain required.");
  }

  if (request.to_state === "executing") {
    warnings.push("'executing' remains a lifecycle label only; execution authority is not granted.");
  }

  if (errors.length > 0) {
    const responseClass = errors.some((entry) => entry.includes("proposed_at"))
      ? "rejected_timestamp"
      : errors.some(
          (entry) =>
            entry.includes("invalid lifecycle transition") ||
            entry.includes("terminal state"),
        )
      ? "rejected_transition"
      : "rejected_policy";

    return {
      ok: false,
      transition_accepted: false,
      response_class: responseClass,
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    transition_accepted: true,
    response_class: "accepted_validation",
    transition_intent: {
      lifecycle_id: request.lifecycle_id,
      from_state: request.from_state,
      to_state: request.to_state,
      execution_granted: false,
      requires_operator_review: true,
    },
    request,
    warnings,
  };
}
