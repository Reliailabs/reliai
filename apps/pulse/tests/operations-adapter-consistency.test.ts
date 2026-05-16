import assert from "node:assert/strict";
import test from "node:test";

import {
  BackendOperationsTimelineRepository,
  BackendProposalLifecycleRepository,
} from "../lib/operations-adapter";

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

type BackendTimelineEventReadFixture = {
  entry_id: string;
  kind: string;
  occurred_at: string;
  organization_id: string;
  project_id: string | null;
  lifecycle_id: string | null;
  proposal_id: string | null;
  incident_id: string | null;
  severity: string | null;
  lifecycle_state: string | null;
  actor_type: "human" | "system";
  actor_label: string;
  title: string;
  summary: string;
  policy_gate_result: "passed" | "denied" | null;
  evidence_refs: Array<{ label: string; href: string }>;
  requires_operator_review: true;
};

function makeTimelinePayload(): BackendTimelineEventReadFixture {
  return {
    entry_id: "otl-consistency-0001",
    kind: "verification_result",
    occurred_at: "2026-05-12T09:00:00.000Z",
    organization_id: "org-demo",
    project_id: "proj-demo",
    lifecycle_id: "lifecycle-consistency-0001",
    proposal_id: "proposal-consistency-0001",
    incident_id: "inc-001",
    severity: "high",
    lifecycle_state: "verified",
    actor_type: "system",
    actor_label: "Reliai System",
    title: "Verification passed",
    summary: "Consistency fixture.",
    policy_gate_result: "passed",
    evidence_refs: [{ label: "Proof", href: "/ops/proof" }],
    requires_operator_review: true,
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

test("phase11.3: timeline adapter maps all intended timeline read-model fields", async () => {
  const repo = new BackendOperationsTimelineRepository(TEST_TOKEN);
  const payload = makeTimelinePayload();

  const mapped = await withMockedFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ items: [payload], total: 1 }),
      }) as Response,
    () => repo.fetchAll(),
  );

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].entry_id, payload.entry_id);
  assert.equal(mapped[0].kind, payload.kind);
  assert.equal(mapped[0].occurred_at, payload.occurred_at);
  assert.equal(mapped[0].organization_id, payload.organization_id);
  assert.equal(mapped[0].project_id, payload.project_id);
  assert.equal(mapped[0].lifecycle_id, payload.lifecycle_id);
  assert.equal(mapped[0].proposal_id, payload.proposal_id);
  assert.equal(mapped[0].incident_id, payload.incident_id);
  assert.equal(mapped[0].severity, payload.severity);
  assert.equal(mapped[0].lifecycle_state, payload.lifecycle_state);
  assert.equal(mapped[0].actor_type, payload.actor_type);
  assert.equal(mapped[0].actor_label, payload.actor_label);
  assert.equal(mapped[0].title, payload.title);
  assert.equal(mapped[0].summary, payload.summary);
  assert.equal(mapped[0].policy_gate_result, payload.policy_gate_result);
  assert.deepEqual(mapped[0].evidence_refs, payload.evidence_refs);
  assert.equal(mapped[0].requires_operator_review, true);
});

test("phase11.3: timeline adapter unmapped fields are empty by contract", () => {
  const payload = makeTimelinePayload();

  const backendKeys = Object.keys(payload).sort();
  const mappedKeys = [
    "entry_id",
    "kind",
    "occurred_at",
    "organization_id",
    "project_id",
    "lifecycle_id",
    "proposal_id",
    "incident_id",
    "severity",
    "lifecycle_state",
    "actor_type",
    "actor_label",
    "title",
    "summary",
    "policy_gate_result",
    "evidence_refs",
    "requires_operator_review",
  ].sort();

  const unmapped = backendKeys.filter((key) => !mappedKeys.includes(key)).sort();
  assert.deepEqual(
    unmapped,
    [],
    `Unexpected timeline backend fields are unmapped: ${unmapped.join(", ")}`,
  );
});
