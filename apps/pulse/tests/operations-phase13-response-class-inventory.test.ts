import assert from "node:assert/strict";
import test from "node:test";

import { PHASE13_RESPONSE_CLASS } from "../app/api/actions/operations/_response";

test("phase13 response-class inventory is explicit and stable", () => {
  assert.deepEqual(
    PHASE13_RESPONSE_CLASS,
    {
      acceptedValidation: "accepted_validation",
      acceptedDuplicate: "accepted_duplicate",
      rejectedSchema: "rejected_schema",
      rejectedIdempotency: "rejected_idempotency",
      rejectedPolicy: "rejected_policy",
      rejectedTimestamp: "rejected_timestamp",
      rejectedTargetMismatch: "rejected_target_mismatch",
      rejectedTransition: "rejected_transition",
    },
    [
      "Phase 13 response_class inventory changed.",
      "If intentional, update:",
      "- tests/operations-phase13-response-class-inventory.test.ts",
      "- tests/operations-phase13-error-envelope.test.ts",
      "- tests/operations-retry-policy.test.ts",
      "- docs/phase13-closure-gate.md",
    ].join("\n"),
  );
});

test("phase13 response-class naming remains contract-constrained", () => {
  const values = Object.values(PHASE13_RESPONSE_CLASS);
  assert.equal(values.length, new Set(values).size, "response_class values must be unique");
  for (const value of values) {
    assert.match(value, /^(accepted|rejected)_[a-z0-9_]+$/);
  }
});
