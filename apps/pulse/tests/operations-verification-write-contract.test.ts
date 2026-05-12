import assert from "node:assert/strict";
import test from "node:test";

import { validateVerificationWriteContract } from "../lib/operations-verification-write";

const basePayload = {
  lifecycle_id: "lifecycle-abc123",
  proposal_id: "proposal-123",
  verification_result_id: "vr-123",
  outcome: "passed",
  verified_at: "2026-05-12T12:00:00.000Z",
  organization_id: "org_1",
  evidence_refs: [{ label: "Verification detail", href: "/operations/incidents/inc_001?tab=verification" }],
  policy_checks: {
    evidence_present: true,
    policy_blocked: false,
    operator_review_required: true,
  },
} as const;

test("accepts valid verification write intent", () => {
  const result = validateVerificationWriteContract(basePayload, new Date("2026-05-12T12:01:00.000Z"));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.response_class, "accepted_validation");
    assert.equal(result.verification_write_intent.execution_granted, false);
  }
});

test("rejects policy block", () => {
  const result = validateVerificationWriteContract(
    {
      ...basePayload,
      policy_checks: {
        ...basePayload.policy_checks,
        policy_blocked: true,
      },
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_policy");
  }
});

test("rejects future verified_at beyond skew", () => {
  const result = validateVerificationWriteContract(
    {
      ...basePayload,
      verified_at: "2026-05-12T13:30:00.000Z",
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_timestamp");
  }
});
