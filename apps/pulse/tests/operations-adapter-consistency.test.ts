import assert from "node:assert/strict";
import test from "node:test";

import { BackendProposalLifecycleRepository } from "../lib/operations-adapter";

const TEST_TOKEN = async () => "test-session-token";

type BackendLifecycleReadFixture = {
  lifecycle_id: string;
  proposal_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  organization_id: string;
  project_id: string | null;
  state: string;
  execution_granted: false;
  requires_operator_review: true;
  operator_email: string | null;
  verification_result_id: string | null;
  audit_receipt_id: string | null;
  failure_reason: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  state_history: Array<{
    from_state: string;
    to_state: string;
    transitioned_at: string;
    reason: string | null;
  }>;
};

function makeLifecyclePayload(): BackendLifecycleReadFixture {
  return {
    lifecycle_id: "lifecycle-consistency-0001",
    proposal_id: "proposal-consistency-0001",
    action_type: "ack",
    target_type: "incident",
    target_id: "inc-001",
    organization_id: "org-demo",
    project_id: "proj-demo",
    state: "verified",
    execution_granted: false,
    requires_operator_review: true,
    operator_email: "ops@acme.test",
    verification_result_id: "vr-001",
    audit_receipt_id: "ops-audit-001",
    failure_reason: null,
    expires_at: "2026-05-20T00:00:00.000Z",
    created_at: "2026-05-12T09:00:00.000Z",
    updated_at: "2026-05-12T09:05:00.000Z",
    state_history: [
      {
        from_state: "executing",
        to_state: "verified",
        transitioned_at: "2026-05-12T09:05:00.000Z",
        reason: "Verification passed.",
      },
    ],
  };
}

async function withMockedFetch<T>(
  mockImpl: typeof fetch,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("phase11.2: lifecycle adapter maps all intended LifecycleRead fields", async () => {
  const repo = new BackendProposalLifecycleRepository(TEST_TOKEN);
  const payload = makeLifecyclePayload();

  const mapped = await withMockedFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => payload,
      }) as Response,
    () => repo.fetchById(payload.lifecycle_id),
  );

  assert.ok(mapped);
  assert.equal(mapped?.lifecycle_id, payload.lifecycle_id);
  assert.equal(mapped?.proposal_id, payload.proposal_id);
  assert.equal(mapped?.action_type, payload.action_type);
  assert.equal(mapped?.target_type, payload.target_type);
  assert.equal(mapped?.target_id, payload.target_id);
  assert.equal(mapped?.organization_id, payload.organization_id);
  assert.equal(mapped?.state, payload.state);
  assert.equal(mapped?.execution_granted, false);
  assert.equal(mapped?.requires_operator_review, true);
  assert.equal(mapped?.operator_email, payload.operator_email);
  assert.equal(mapped?.verification_result_id, payload.verification_result_id);
  assert.equal(mapped?.failure_reason, payload.failure_reason);
  assert.equal(mapped?.expires_at, payload.expires_at);
  assert.equal(mapped?.created_at, payload.created_at);
  assert.equal(mapped?.updated_at, payload.updated_at);
  assert.equal(mapped?.state_history.length, 1);
  assert.deepEqual(mapped?.state_history[0], payload.state_history[0]);
});

test("phase11.2: unmapped backend lifecycle fields are explicit and allowlisted", async () => {
  const payload = makeLifecyclePayload();

  const backendKeys = Object.keys(payload).sort();
  const mappedKeys = [
    "lifecycle_id",
    "proposal_id",
    "action_type",
    "target_type",
    "target_id",
    "organization_id",
    "state",
    "execution_granted",
    "requires_operator_review",
    "operator_email",
    "verification_result_id",
    "failure_reason",
    "expires_at",
    "created_at",
    "updated_at",
    "state_history",
  ].sort();

  const unmapped = backendKeys.filter((key) => !mappedKeys.includes(key)).sort();

  assert.deepEqual(
    unmapped,
    ["audit_receipt_id", "project_id"],
    `Unexpected backend lifecycle fields are unmapped: ${unmapped.join(", ")}`,
  );
});
