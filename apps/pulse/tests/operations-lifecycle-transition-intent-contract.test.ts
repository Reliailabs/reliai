import assert from "node:assert/strict";
import test from "node:test";

import { validateLifecycleTransitionIntent } from "../lib/operations-lifecycle-transition-intent";

const basePayload = {
  lifecycle_id: "lifecycle-abc123",
  organization_id: "org_1",
  from_state: "detected",
  to_state: "analyzed",
  proposed_at: "2026-05-12T12:00:00.000Z",
  reason: "Signal quality improved after analyst review.",
  evidence_refs: [{ label: "Incident ops", href: "/operations/incidents/inc_001" }],
  policy_checks: {
    evidence_present: true,
    policy_blocked: false,
    operator_review_required: true,
  },
} as const;

test("accepts valid transition intent", () => {
  const result = validateLifecycleTransitionIntent(basePayload, new Date("2026-05-12T12:01:00.000Z"));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.response_class, "accepted_validation");
    assert.equal(result.transition_intent.execution_granted, false);
    assert.equal(result.transition_intent.to_state, "analyzed");
  }
});

test("rejects invalid edge", () => {
  const result = validateLifecycleTransitionIntent(
    {
      ...basePayload,
      to_state: "staged",
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_transition");
  }
});

test("rejects transition from terminal state", () => {
  const result = validateLifecycleTransitionIntent(
    {
      ...basePayload,
      from_state: "verified",
      to_state: "failed",
    },
    new Date("2026-05-12T12:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response_class, "rejected_transition");
  }
});

test("rejects policy block", () => {
  const result = validateLifecycleTransitionIntent(
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
