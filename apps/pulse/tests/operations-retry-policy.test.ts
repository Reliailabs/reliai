import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRetryPolicy } from "../lib/operations-retry-policy";

test("timestamp rejection is retryable with retry_after", () => {
  const result = evaluateRetryPolicy({ attempt: 1, responseClass: "rejected_timestamp" });
  assert.equal(result.retryable, true);
  assert.equal(result.retry_after_ms, 15000);
});

test("schema rejection is non-retryable", () => {
  const result = evaluateRetryPolicy({ attempt: 1, responseClass: "rejected_schema" });
  assert.equal(result.retryable, false);
  assert.equal(result.retry_after_ms, null);
});

test("max attempts reached blocks retry", () => {
  const result = evaluateRetryPolicy({ attempt: 3, maxAttempts: 3, responseClass: "rejected_timestamp" });
  assert.equal(result.retryable, false);
  assert.equal(result.reason, "max_attempts_reached");
});
