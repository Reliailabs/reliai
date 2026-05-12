export type RetryEvaluationInput = {
  attempt: number;
  maxAttempts?: number;
  responseClass:
    | "accepted_validation"
    | "accepted_duplicate"
    | "rejected_schema"
    | "rejected_idempotency"
    | "rejected_policy"
    | "rejected_timestamp"
    | "rejected_target_mismatch"
    | "rejected_transition";
};

export type RetryEvaluationResult = {
  retryable: boolean;
  retry_after_ms: number | null;
  reason: string;
};

const DEFAULT_MAX_ATTEMPTS = 3;

export function evaluateRetryPolicy(input: RetryEvaluationInput): RetryEvaluationResult {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  if (input.attempt >= maxAttempts) {
    return { retryable: false, retry_after_ms: null, reason: "max_attempts_reached" };
  }

  switch (input.responseClass) {
    case "accepted_validation":
    case "accepted_duplicate":
    case "rejected_schema":
    case "rejected_idempotency":
    case "rejected_policy":
    case "rejected_target_mismatch":
    case "rejected_transition":
      return { retryable: false, retry_after_ms: null, reason: "non_retryable_class" };
    case "rejected_timestamp":
      return { retryable: true, retry_after_ms: 15000, reason: "clock_skew_or_timing_window" };
    default:
      return { retryable: false, retry_after_ms: null, reason: "unknown_response_class" };
  }
}
