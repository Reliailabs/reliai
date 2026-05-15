import assert from "node:assert/strict";
import test from "node:test";

import type { ProposalLifecycle } from "@/lib/proposal-lifecycle";
import {
  deriveVerificationResultsFromLifecycles,
  getVerificationResults,
  InMemoryVerificationResultRepository,
  mapLifecycleToVerificationResult,
  type VerificationResultRecord,
} from "@/lib/operations-verification-results";

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

test("mapLifecycleToVerificationResult returns null for non-verification states", () => {
  const mapped = mapLifecycleToVerificationResult(makeLifecycle({ state: "approved" }));
  assert.equal(mapped, null);
});

test("mapLifecycleToVerificationResult maps verified/failed with required invariants", () => {
  const verified = mapLifecycleToVerificationResult(
    makeLifecycle({
      lifecycle_id: "lc-verified",
      proposal_id: "prop-verified",
      state: "verified",
      verification_result_id: "vr-123",
      updated_at: "2026-05-15T12:00:00.000Z",
    }),
  );
  assert.ok(verified);
  assert.equal(verified?.outcome, "passed");
  assert.equal(verified?.execution_granted, false);
  assert.equal(verified?.requires_operator_review, true);

  const failed = mapLifecycleToVerificationResult(
    makeLifecycle({
      lifecycle_id: "lc-failed",
      proposal_id: "prop-failed",
      state: "failed",
      verification_result_id: "vr-456",
      updated_at: "2026-05-15T13:00:00.000Z",
    }),
  );
  assert.ok(failed);
  assert.equal(failed?.outcome, "failed");
});

test("deriveVerificationResultsFromLifecycles filters, maps, and sorts by verified_at desc", () => {
  const records = deriveVerificationResultsFromLifecycles([
    makeLifecycle({ lifecycle_id: "lc-a", proposal_id: "prop-a", state: "failed", verification_result_id: "vr-a", updated_at: "2026-05-15T09:00:00.000Z" }),
    makeLifecycle({ lifecycle_id: "lc-b", proposal_id: "prop-b", state: "verified", verification_result_id: "vr-b", updated_at: "2026-05-15T11:00:00.000Z" }),
    makeLifecycle({ lifecycle_id: "lc-c", proposal_id: "prop-c", state: "approved", verification_result_id: null, updated_at: "2026-05-15T12:00:00.000Z" }),
  ]);

  assert.equal(records.length, 2);
  assert.equal(records[0].verification_result_id, "vr-b");
  assert.equal(records[1].verification_result_id, "vr-a");
});

test("InMemoryVerificationResultRepository supports read/write contract semantics", () => {
  const repo = new InMemoryVerificationResultRepository();

  const record: VerificationResultRecord = {
    verification_result_id: "vr-1",
    lifecycle_id: "lc-1",
    proposal_id: "prop-1",
    organization_id: "org-demo",
    target_id: "inc-1",
    outcome: "passed",
    verified_at: "2026-05-15T12:00:00.000Z",
    execution_granted: false,
    requires_operator_review: true,
  };

  repo.save(record);
  assert.equal(repo.findAll().length, 1);
  assert.equal(repo.findById("vr-1")?.proposal_id, "prop-1");

  repo.save({ ...record, proposal_id: "prop-1b" });
  assert.equal(repo.findAll().length, 1);
  assert.equal(repo.findById("vr-1")?.proposal_id, "prop-1b");
});

test("getVerificationResults applies filter through injected repository", () => {
  const repo = new InMemoryVerificationResultRepository([
    {
      verification_result_id: "vr-1",
      lifecycle_id: "lc-1",
      proposal_id: "prop-1",
      organization_id: "org-a",
      target_id: "inc-1",
      outcome: "passed",
      verified_at: "2026-05-15T10:00:00.000Z",
      execution_granted: false,
      requires_operator_review: true,
    },
    {
      verification_result_id: "vr-2",
      lifecycle_id: "lc-2",
      proposal_id: "prop-2",
      organization_id: "org-b",
      target_id: "reg-9",
      outcome: "failed",
      verified_at: "2026-05-15T11:00:00.000Z",
      execution_granted: false,
      requires_operator_review: true,
    },
  ]);

  const orgA = getVerificationResults({ organization_id: "org-a" }, repo);
  assert.equal(orgA.length, 1);
  assert.equal(orgA[0].verification_result_id, "vr-1");

  const failed = getVerificationResults({ outcome: "failed" }, repo);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].verification_result_id, "vr-2");
});
