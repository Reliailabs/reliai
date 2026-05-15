import assert from "node:assert/strict";
import test from "node:test";

import type { ProposalLifecycle } from "@/lib/proposal-lifecycle";
import type { OperationsIntentProjection } from "@/lib/operations-ingest-projections";
import {
  buildReliabilityScoreSnapshot,
  clampScore,
  getReliabilityScore,
  InMemoryReliabilityScoreRepository,
} from "@/lib/operations-reliability-score";

function makeLifecycle(overrides: Partial<ProposalLifecycle> = {}): ProposalLifecycle {
  return {
    lifecycle_id: "lc-1",
    proposal_id: "prop-1",
    action_type: "rollback",
    target_type: "incident",
    target_id: "inc-1",
    organization_id: "org-demo",
    created_at: "2026-05-15T10:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    execution_granted: false,
    requires_operator_review: true,
    state: "detected",
    updated_at: "2026-05-15T10:00:00.000Z",
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [],
    ...overrides,
  };
}

function makeVerificationIntent(
  overrides: Partial<OperationsIntentProjection> = {},
): OperationsIntentProjection {
  return {
    event_id: "evt-1",
    idempotency_key: "idem-1",
    event_type: "verification_result",
    accepted_at: "2026-05-15T11:00:00.000Z",
    organization_id: "org-demo",
    target_id: "verification-1",
    action_type: "verify",
    target_type: "verification",
    proposal_id: "prop-1",
    lifecycle_id: "lc-1",
    outcome: null,
    ...overrides,
  };
}

test("clampScore clamps and rounds values", () => {
  assert.equal(clampScore(-10), 0);
  assert.equal(clampScore(49.6), 50);
  assert.equal(clampScore(140), 100);
});

test("buildReliabilityScoreSnapshot computes deterministic score fields", () => {
  const lifecycles: ProposalLifecycle[] = [
    makeLifecycle({ lifecycle_id: "lc-v1", state: "verified" }),
    makeLifecycle({ lifecycle_id: "lc-v2", state: "verified" }),
    makeLifecycle({ lifecycle_id: "lc-f1", state: "failed" }),
    makeLifecycle({ lifecycle_id: "lc-r1", state: "rolled_back" }),
  ];

  const intents: OperationsIntentProjection[] = [
    makeVerificationIntent({ event_id: "evt-pass-1", outcome: "passed" }),
    makeVerificationIntent({ event_id: "evt-pass-2", outcome: "passed" }),
    makeVerificationIntent({ event_id: "evt-fail-1", outcome: "failed" }),
  ];

  const snapshot = buildReliabilityScoreSnapshot(
    lifecycles,
    intents,
    "2026-05-15T12:00:00.000Z",
    "org-demo",
  );

  assert.equal(snapshot.verified_count, 2);
  assert.equal(snapshot.failed_count, 1);
  assert.equal(snapshot.rolled_back_count, 1);
  assert.equal(snapshot.verification_pass_rate, 0.6667);
  assert.equal(snapshot.reliability_score, 66);
  assert.equal(snapshot.execution_granted, false);
  assert.equal(snapshot.requires_operator_review, true);
});

test("buildReliabilityScoreSnapshot treats missing verification outcomes as null rate", () => {
  const snapshot = buildReliabilityScoreSnapshot(
    [makeLifecycle({ state: "verified" })],
    [makeVerificationIntent({ outcome: null })],
    "2026-05-15T12:30:00.000Z",
    "org-demo",
  );

  assert.equal(snapshot.verification_pass_rate, null);
});

test("InMemoryReliabilityScoreRepository sorts newest first and filters by org/project", () => {
  const repo = new InMemoryReliabilityScoreRepository([
    {
      snapshot_id: "score-1",
      captured_at: "2026-05-15T10:00:00.000Z",
      organization_id: "org-a",
      project_id: null,
      reliability_score: 70,
      verification_pass_rate: 0.5,
      verified_count: 1,
      failed_count: 0,
      rolled_back_count: 0,
      requires_operator_review: true,
      execution_granted: false,
    },
    {
      snapshot_id: "score-2",
      captured_at: "2026-05-15T12:00:00.000Z",
      organization_id: "org-b",
      project_id: "proj-1",
      reliability_score: 65,
      verification_pass_rate: 0.4,
      verified_count: 1,
      failed_count: 1,
      rolled_back_count: 0,
      requires_operator_review: true,
      execution_granted: false,
    },
  ]);

  const all = repo.findAll();
  assert.equal(all[0].snapshot_id, "score-2");

  const orgFiltered = repo.findAll({ organization_id: "org-a" });
  assert.equal(orgFiltered.length, 1);
  assert.equal(orgFiltered[0].snapshot_id, "score-1");

  const projectFiltered = repo.findAll({ project_id: "proj-1" });
  assert.equal(projectFiltered.length, 1);
  assert.equal(projectFiltered[0].snapshot_id, "score-2");
});

test("getReliabilityScore returns latest snapshot from injected repository", () => {
  const repo = new InMemoryReliabilityScoreRepository([
    {
      snapshot_id: "score-old",
      captured_at: "2026-05-15T08:00:00.000Z",
      organization_id: "org-demo",
      project_id: null,
      reliability_score: 61,
      verification_pass_rate: 0.33,
      verified_count: 2,
      failed_count: 1,
      rolled_back_count: 1,
      requires_operator_review: true,
      execution_granted: false,
    },
    {
      snapshot_id: "score-new",
      captured_at: "2026-05-15T09:00:00.000Z",
      organization_id: "org-demo",
      project_id: null,
      reliability_score: 68,
      verification_pass_rate: 0.66,
      verified_count: 3,
      failed_count: 1,
      rolled_back_count: 0,
      requires_operator_review: true,
      execution_granted: false,
    },
  ]);

  const snapshot = getReliabilityScore(repo);
  assert.equal(snapshot.snapshot_id, "score-new");
});
