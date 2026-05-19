import assert from "node:assert/strict";
import test from "node:test";

import {
  phase13AcceptedDuplicateResponse,
  phase13AcceptedValidationResponse,
  phase13ErrorResponse,
  phase13RejectedIdempotencyResponse,
  phase13RejectedPolicyResponse,
  phase13ValidationRejectionResponse,
  PHASE13_HTTP_STATUS,
  PHASE13_RESPONSE_CLASS,
} from "../app/api/actions/operations/_response";

test("phase13 error envelope includes all validation acceptance flags", async () => {
  const response = phase13ErrorResponse(401, "unauthorized");
  assert.equal(response.status, PHASE13_HTTP_STATUS.unauthorized);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.rejectedPolicy);
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
  assert.equal(response.status, PHASE13_HTTP_STATUS.invalidRequest);

  const payload = (await response.json()) as { errors?: unknown };
  assert.deepEqual(payload.errors, ["invalid JSON body"]);
  assert.equal((payload as Record<string, unknown>).response_class, PHASE13_RESPONSE_CLASS.rejectedSchema);
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
  assert.equal(response.status, PHASE13_HTTP_STATUS.policyRejected);

  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.rejectedPolicy);
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
    assert.equal(response.status, PHASE13_HTTP_STATUS.policyRejected);
    const payload = (await response.json()) as Record<string, unknown>;
    assert.equal(payload[c.key], false, `${c.key} must be false in rejected-policy envelope`);
    assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.rejectedPolicy);
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
      response_class: PHASE13_RESPONSE_CLASS.rejectedTimestamp,
      errors: ["occurred_at must be within 24h"],
      warnings: [],
    },
    422,
  );

  assert.equal(response.status, PHASE13_HTTP_STATUS.validationRejected);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.rejectedTimestamp);
  assert.deepEqual(payload.retry_policy, {
    retryable: true,
    retry_after_ms: 15000,
    reason: "clock_skew_or_timing_window",
  });
});

test("phase13 rejected-idempotency helper keeps deterministic 409 envelope", async () => {
  const response = phase13RejectedIdempotencyResponse({
    message: "idempotency key replay with changed event semantics",
    duplicateOfEventId: "evt-001",
    eventFingerprint: "opsevt-abc",
  });

  assert.equal(response.status, PHASE13_HTTP_STATUS.idempotencyRejected);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, false);
  assert.equal(payload.ingest_accepted, false);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.rejectedIdempotency);
  assert.equal(payload.duplicate_of_event_id, "evt-001");
  assert.equal(payload.event_fingerprint, "opsevt-abc");
  assert.deepEqual(payload.errors, ["idempotency key replay with changed event semantics"]);
  assert.deepEqual(payload.retry_policy, {
    retryable: false,
    retry_after_ms: null,
    reason: "non_retryable_class",
  });
});

test("phase13 accepted-duplicate helper keeps deterministic 200 envelope", async () => {
  const response = phase13AcceptedDuplicateResponse({
    warningMessage: "duplicate replay accepted",
    duplicateOfEventId: "evt-001",
    eventFingerprint: "opsevt-abc",
    requestShapeHash: "shape-123",
    auditReceipt: {
      event_id: "evt-dup-1",
      issued_at: "2026-05-18T22:00:00.000Z",
      immutable_fields: ["idempotency_key"],
      reason: "duplicate replay accepted",
    },
  });

  assert.equal(response.status, PHASE13_HTTP_STATUS.accepted);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, true);
  assert.equal(payload.ingest_accepted, true);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.acceptedDuplicate);
  assert.deepEqual(payload.warnings, ["duplicate replay accepted"]);
  assert.equal(payload.duplicate_of_event_id, "evt-001");
  assert.equal(payload.event_fingerprint, "opsevt-abc");
  assert.equal(payload.request_shape_hash, "shape-123");
  assert.deepEqual(payload.audit_receipt, {
    event_id: "evt-dup-1",
    issued_at: "2026-05-18T22:00:00.000Z",
    immutable_fields: ["idempotency_key"],
    reason: "duplicate replay accepted",
  });
  assert.equal(payload.retry_policy, undefined);
});

test("phase13 accepted-validation helper keeps deterministic 200 envelope", async () => {
  const response = phase13AcceptedValidationResponse(
    {
      ok: true as const,
      ingest_accepted: true as const,
      response_class: PHASE13_RESPONSE_CLASS.acceptedValidation,
      event_fingerprint: "opsevt-xyz",
      request_shape_hash: "shape-xyz",
      immutable_fields: ["idempotency_key"],
      warnings: [],
    },
    {
      event_id: "evt-ok-1",
      issued_at: "2026-05-18T22:30:00.000Z",
      immutable_fields: ["idempotency_key"],
      reason: "accepted in validation-only mode",
    },
  );

  assert.equal(response.status, PHASE13_HTTP_STATUS.accepted);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.contract_version, "phase13-v1");
  assert.equal(payload.mode, "validation_only");
  assert.equal(payload.execution_granted, false);
  assert.equal(payload.ok, true);
  assert.equal(payload.ingest_accepted, true);
  assert.equal(payload.response_class, PHASE13_RESPONSE_CLASS.acceptedValidation);
  assert.equal(payload.event_fingerprint, "opsevt-xyz");
  assert.equal(payload.request_shape_hash, "shape-xyz");
  assert.deepEqual(payload.immutable_fields, ["idempotency_key"]);
  assert.deepEqual(payload.audit_receipt, {
    event_id: "evt-ok-1",
    issued_at: "2026-05-18T22:30:00.000Z",
    immutable_fields: ["idempotency_key"],
    reason: "accepted in validation-only mode",
  });
  assert.equal(payload.retry_policy, undefined);
});
