import assert from "node:assert/strict";
import test from "node:test";

import {
  phase13ErrorResponse,
  phase13RejectedPolicyResponse,
  phase13ValidationRejectionResponse,
} from "../app/api/actions/operations/_response";

test("phase13 error envelope includes all validation acceptance flags", async () => {
  const response = phase13ErrorResponse(401, "unauthorized");
  assert.equal(response.status, 401);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.response_class, "rejected_policy");
  assert.equal(payload.ingest_accepted, false);
  assert.equal(payload.create_accepted, false);
  assert.equal(payload.transition_accepted, false);
  assert.equal(payload.verification_write_accepted, false);
  assert.deepEqual(payload.retry_policy, {
    retryable: false,
    retry_after_ms: null,
    reason: "non_retryable_class",
  });
});

test("phase13 error envelope preserves explicit parse errors", async () => {
  const response = phase13ErrorResponse(400, "invalid JSON body");
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { errors?: unknown };
  assert.deepEqual(payload.errors, ["invalid JSON body"]);
  assert.equal((payload as Record<string, unknown>).response_class, "rejected_schema");
  assert.deepEqual((payload as Record<string, unknown>).retry_policy, {
    retryable: false,
    retry_after_ms: null,
    reason: "non_retryable_class",
  });
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

test("phase13 rejected-policy helper preserves acceptance-flag parity across validator types", async () => {
  const cases = [
    { flags: { ingest_accepted: false as const }, key: "ingest_accepted" },
    { flags: { create_accepted: false as const }, key: "create_accepted" },
    { flags: { transition_accepted: false as const }, key: "transition_accepted" },
    { flags: { verification_write_accepted: false as const }, key: "verification_write_accepted" },
  ] as const;

  for (const c of cases) {
    const response = phase13RejectedPolicyResponse(c.flags, "persistence backend unavailable");
    assert.equal(response.status, 503);
    const payload = (await response.json()) as Record<string, unknown>;
    assert.equal(payload[c.key], false, `${c.key} must be false in rejected-policy envelope`);
    assert.equal(payload.response_class, "rejected_policy");
    assert.deepEqual(payload.retry_policy, {
      retryable: false,
      retry_after_ms: null,
      reason: "non_retryable_class",
    });
  }
});

test("phase13 validation-rejection helper injects deterministic retry policy", async () => {
  const response = phase13ValidationRejectionResponse(
    {
      ok: false as const,
      response_class: "rejected_timestamp" as const,
      errors: ["occurred_at must be within 24h"],
      warnings: [],
    },
    422,
  );

  assert.equal(response.status, 422);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.response_class, "rejected_timestamp");
  assert.deepEqual(payload.retry_policy, {
    retryable: true,
    retry_after_ms: 15000,
    reason: "clock_skew_or_timing_window",
  });
});
