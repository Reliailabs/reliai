import assert from "node:assert/strict";
import test from "node:test";

import { validateOperationsEventIngest } from "../lib/operations-ingest";
import { validateLifecycleCreateContract } from "../lib/operations-lifecycle-create";
import { validateLifecycleTransitionIntent } from "../lib/operations-lifecycle-transition-intent";
import { validateVerificationWriteContract } from "../lib/operations-verification-write";

const now = new Date("2026-05-12T12:01:00.000Z");

test("phase13 write-path contracts align on validation-only invariants", () => {
  const ingest = validateOperationsEventIngest(
    {
      event_id: "evt_01",
      idempotency_key: "idem-key-01",
      event_type: "incident_lifecycle",
      occurred_at: "2026-05-12T12:00:00.000Z",
      request_context: {
        organization_id: "org_1",
        project_id: "proj_1",
        environment_id: "production",
      },
      actor: {
        actor_type: "system",
        actor_id: "ops-worker",
      },
      target: {
        target_type: "incident",
        target_id: "inc_001",
      },
      payload: { state: "detected" },
      evidence_refs: [{ label: "Incident ops", href: "/operations/incidents/inc_001" }],
    },
    now,
  );

  const create = validateLifecycleCreateContract(
    {
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
    },
    now,
  );

  const transition = validateLifecycleTransitionIntent(
    {
      lifecycle_id: "lifecycle-abc123",
      organization_id: "org_1",
      from_state: "detected",
      to_state: "analyzed",
      proposed_at: "2026-05-12T12:00:00.000Z",
      reason: "Analyst triage completed.",
      evidence_refs: [{ label: "Incident ops", href: "/operations/incidents/inc_001" }],
      policy_checks: {
        evidence_present: true,
        policy_blocked: false,
        operator_review_required: true,
      },
    },
    now,
  );

  const verification = validateVerificationWriteContract(
    {
      lifecycle_id: "lifecycle-abc123",
      proposal_id: "prop_001",
      verification_result_id: "vr-001",
      outcome: "passed",
      verified_at: "2026-05-12T12:00:00.000Z",
      organization_id: "org_1",
      evidence_refs: [{ label: "Verification", href: "/operations/incidents/inc_001?tab=verification" }],
      policy_checks: {
        evidence_present: true,
        policy_blocked: false,
        operator_review_required: true,
      },
    },
    now,
  );

  assert.equal(ingest.ok, true);
  assert.equal(create.ok, true);
  assert.equal(transition.ok, true);
  assert.equal(verification.ok, true);

  if (create.ok) {
    assert.equal(create.lifecycle_preview.execution_granted, false);
    assert.equal(create.lifecycle_preview.requires_operator_review, true);
  }

  if (transition.ok) {
    assert.equal(transition.transition_intent.execution_granted, false);
    assert.equal(transition.transition_intent.requires_operator_review, true);
  }

  if (verification.ok) {
    assert.equal(verification.verification_write_intent.execution_granted, false);
    assert.equal(verification.verification_write_intent.requires_operator_review, true);
  }
});
