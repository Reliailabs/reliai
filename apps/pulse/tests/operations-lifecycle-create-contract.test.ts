import assert from "node:assert/strict";
import test from "node:test";

import { validateLifecycleCreateContract } from "../lib/operations-lifecycle-create";

const basePayload = {
  proposal_id: "prop_001",
  action_type: "propose_guardrail",
  target_type: "incident",
  target_id: "inc_001",
  organization_id: "org_1",
  created_at: "2026-05-12T12:00:00.000Z",
  expires_at: "2026-05-12T13:00:00.000Z",
  evidence_refs: [{ label: "Incident ops", href: "/operations/incidents/inc_001" }],
  policy_checks: {
    evidence_present: true,
    policy_blocked: false,
    operator_review_required: true,
  },
} as const;

test("accepts valid lifecycle creation request", () => {
  const result = validateLifecycleCreateContract(basePayload, new Date("2026-05-12T12:01:00.000Z"));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.response_class, "accepted_validation");
    assert.equal(result.lifecycle_preview.execution_granted, false);
    assert.ok(result.immutable_fields.includes("proposal_id"));
  }
});

test("rejects blocked policy", () => {
  const result = validateLifecycleCreateContract(
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

test("rejects invalid timestamp window", () => {
  const result = validateLifecycleCreateContract(
    {
      ...basePayload,
      expires_at: "2026-05-12T11:59:00.000Z",
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_timestamp");
  }
});
