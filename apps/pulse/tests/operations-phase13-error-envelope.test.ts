import assert from "node:assert/strict";
import test from "node:test";

import { phase13ErrorResponse, phase13RejectedPolicyResponse } from "../app/api/actions/operations/_response";

test("phase13 error envelope includes all validation acceptance flags", async () => {
  const response = phase13ErrorResponse(401, "unauthorized");
  assert.equal(response.status, 401);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.ingest_accepted, false);
  assert.equal(payload.create_accepted, false);
  assert.equal(payload.transition_accepted, false);
  assert.equal(payload.verification_write_accepted, false);
});

test("phase13 error envelope preserves explicit parse errors", async () => {
  const response = phase13ErrorResponse(400, "invalid JSON body");
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { errors?: unknown };
  assert.deepEqual(payload.errors, ["invalid JSON body"]);
});

test("phase13 rejected-policy helper includes retry policy and route-specific acceptance flags", async () => {
  const response = phase13RejectedPolicyResponse(
    { transition_accepted: false },
    "lifecycle-transition persistence backend unavailable",
  );
  assert.equal(response.status, 503);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.response_class, "rejected_policy");
  assert.equal(payload.transition_accepted, false);
  assert.deepEqual(payload.errors, ["lifecycle-transition persistence backend unavailable"]);
  assert.deepEqual(payload.retry_policy, {
    retryable: false,
    retry_after_ms: null,
    reason: "non_retryable_class",
  });
});
