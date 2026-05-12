import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryProposalLifecycleRepository,
  type LifecycleStateHistoryEntry,
  type ProposalLifecycle,
  type ProposalLifecycleState,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  completeProposalExecution,
  failProposalExecution,
  getLifecycleById,
  listLifecycles,
  transitionLifecycle,
  verifyProposalOutcome,
} from "../lib/proposal-lifecycle";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeLifecycle(
  overrides: Partial<ProposalLifecycle> & { state: ProposalLifecycleState },
): ProposalLifecycle {
  return {
    lifecycle_id: "lifecycle-test0000000001",
    proposal_id: "phase9-inc-test000000001",
    action_type: "ack",
    target_type: "incident",
    target_id: "inc-test-001",
    organization_id: "org-test",
    created_at: "2026-05-11T08:00:00.000Z",
    updated_at: "2026-05-11T08:00:00.000Z",
    expires_at: "2099-12-31T23:59:59.000Z",
    execution_granted: false,
    requires_operator_review: true,
    operator_email: null,
    verification_result_id: null,
    failure_reason: null,
    state_history: [],
    ...overrides,
  };
}

function freshRepo(lifecycles: ProposalLifecycle[] = []): InMemoryProposalLifecycleRepository {
  return new InMemoryProposalLifecycleRepository(lifecycles);
}

// ── Fixture data ──────────────────────────────────────────────────────────────

test("listLifecycles returns all fixture entries", () => {
  const result = listLifecycles();
  // Default fixture covers all 10 states
  assert.ok(result.length >= 10, `expected >= 10 fixture lifecycles, got ${result.length}`);
});

test("listLifecycles filters by state", () => {
  const detected = listLifecycles({ state: "detected" });
  assert.ok(detected.length >= 1);
  assert.ok(detected.every((lc) => lc.state === "detected"));
});

test("listLifecycles filters by organization_id", () => {
  const results = listLifecycles({ organization_id: "org-demo" });
  assert.ok(results.length >= 10);
  assert.ok(results.every((lc) => lc.organization_id === "org-demo"));
});

test("listLifecycles returns empty array for unknown org", () => {
  const results = listLifecycles({ organization_id: "org-nonexistent" });
  assert.equal(results.length, 0);
});

// ── getLifecycleById ──────────────────────────────────────────────────────────

test("getLifecycleById returns null for unknown id", () => {
  const result = getLifecycleById("lifecycle-doesnotexist");
  assert.equal(result, null);
});

test("getLifecycleById returns matching lifecycle from fixture", () => {
  const all = listLifecycles({ state: "approved" });
  assert.ok(all.length >= 1);
  const lc = all[0];
  const found = getLifecycleById(lc.lifecycle_id);
  assert.ok(found !== null);
  assert.equal(found.lifecycle_id, lc.lifecycle_id);
  assert.equal(found.state, "approved");
});

// ── Invariants on fixture data ────────────────────────────────────────────────

test("all fixtures have execution_granted: false", () => {
  const all = listLifecycles();
  for (const lc of all) {
    assert.equal(lc.execution_granted, false, `lifecycle ${lc.lifecycle_id} has execution_granted !== false`);
  }
});

test("all fixtures have requires_operator_review: true", () => {
  const all = listLifecycles();
  for (const lc of all) {
    assert.equal(lc.requires_operator_review, true, `lifecycle ${lc.lifecycle_id} has requires_operator_review !== true`);
  }
});

test("fixture data covers all 10 lifecycle states", () => {
  const all = listLifecycles();
  const states = new Set(all.map((lc) => lc.state));
  const expected: ProposalLifecycleState[] = [
    "detected", "analyzed", "proposed", "staged", "approved",
    "executing", "verified", "failed", "rolled_back", "expired",
  ];
  for (const s of expected) {
    assert.ok(states.has(s), `missing fixture for state '${s}'`);
  }
});

// ── transitionLifecycle ───────────────────────────────────────────────────────

test("transitionLifecycle: detected → analyzed succeeds", () => {
  const repo = freshRepo([makeLifecycle({ state: "detected" })]);
  const result = transitionLifecycle("lifecycle-test0000000001", "analyzed", null, repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "analyzed");
    assert.equal(result.lifecycle.state_history.length, 1);
    assert.equal(result.lifecycle.state_history[0].from_state, "detected");
    assert.equal(result.lifecycle.state_history[0].to_state, "analyzed");
    assert.equal(result.lifecycle.execution_granted, false);
    assert.equal(result.lifecycle.requires_operator_review, true);
  }
});

test("transitionLifecycle: detected → staged fails (skipped edge)", () => {
  const repo = freshRepo([makeLifecycle({ state: "detected" })]);
  const result = transitionLifecycle("lifecycle-test0000000001", "staged", null, repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("not permitted"));
    assert.ok(result.errors[0].includes("detected"));
    assert.ok(result.errors[0].includes("staged"));
  }
});

test("transitionLifecycle: backwards transition fails", () => {
  const repo = freshRepo([makeLifecycle({ state: "proposed" })]);
  const result = transitionLifecycle("lifecycle-test0000000001", "detected", null, repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("not permitted"));
  }
});

test("transitionLifecycle: unknown lifecycleId returns error", () => {
  const repo = freshRepo();
  const result = transitionLifecycle("lifecycle-nonexistent", "analyzed", null, repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("not found"));
  }
});

test("transitionLifecycle: terminal state rejects all transitions", () => {
  for (const terminal of TERMINAL_STATES) {
    const repo = freshRepo([makeLifecycle({ state: terminal })]);
    const result = transitionLifecycle("lifecycle-test0000000001", "detected", null, repo);
    assert.equal(result.ok, false, `expected error transitioning from terminal state '${terminal}'`);
    if (!result.ok) {
      assert.ok(
        result.errors[0].includes("terminal state"),
        `error should mention 'terminal state', got: ${result.errors[0]}`,
      );
    }
  }
});

test("transitionLifecycle: expired lifecycle rejects non-expiry transitions", () => {
  const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const repo = freshRepo([
    makeLifecycle({
      state: "detected",
      expires_at: past,
    }),
  ]);
  const result = transitionLifecycle(
    "lifecycle-test0000000001",
    "analyzed",
    null,
    repo,
    new Date(), // now is after expires_at
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("expired"));
  }
});

test("transitionLifecycle: approved → executing emits invariant warning", () => {
  const repo = freshRepo([makeLifecycle({ state: "approved" })]);
  const result = transitionLifecycle("lifecycle-test0000000001", "executing", null, repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "executing");
    assert.equal(result.lifecycle.execution_granted, false);
    assert.ok(result.warnings.some((w) => w.includes("execution_granted")));
    assert.ok(result.warnings.some((w) => w.includes("lifecycle label only")));
  }
});

test("transitionLifecycle: stores reason in state_history entry", () => {
  const repo = freshRepo([makeLifecycle({ state: "detected" })]);
  const result = transitionLifecycle(
    "lifecycle-test0000000001",
    "analyzed",
    "Evidence threshold met.",
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    const entry = result.lifecycle.state_history[0];
    assert.equal(entry.reason, "Evidence threshold met.");
  }
});

// ── completeProposalExecution ─────────────────────────────────────────────────

test("completeProposalExecution: approved → executing with valid email", () => {
  const repo = freshRepo([makeLifecycle({ state: "approved" })]);
  const result = completeProposalExecution("lifecycle-test0000000001", "ops@acme.test", repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "executing");
    assert.equal(result.lifecycle.operator_email, "ops@acme.test");
    assert.equal(result.lifecycle.execution_granted, false);
    assert.ok(result.warnings.some((w) => w.includes("execution_granted")));
  }
});

test("completeProposalExecution: rejects non-approved state", () => {
  for (const state of ["detected", "analyzed", "proposed", "staged"] as const) {
    const repo = freshRepo([makeLifecycle({ state })]);
    const result = completeProposalExecution("lifecycle-test0000000001", "ops@acme.test", repo);
    assert.equal(result.ok, false, `expected failure from state '${state}'`);
    if (!result.ok) {
      assert.ok(result.errors[0].includes("requires state 'approved'"));
    }
  }
});

test("completeProposalExecution: rejects missing @ in email", () => {
  const repo = freshRepo([makeLifecycle({ state: "approved" })]);
  const result = completeProposalExecution("lifecycle-test0000000001", "notanemail", repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("email"));
  }
});

test("completeProposalExecution: rejects empty email", () => {
  const repo = freshRepo([makeLifecycle({ state: "approved" })]);
  const result = completeProposalExecution("lifecycle-test0000000001", "", repo);
  assert.equal(result.ok, false);
});

test("completeProposalExecution: unknown lifecycleId returns error", () => {
  const repo = freshRepo();
  const result = completeProposalExecution("lifecycle-nonexistent", "ops@acme.test", repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("not found"));
  }
});

// ── verifyProposalOutcome ─────────────────────────────────────────────────────

test("verifyProposalOutcome: executing → verified with result id", () => {
  const repo = freshRepo([makeLifecycle({ state: "executing" })]);
  const result = verifyProposalOutcome("lifecycle-test0000000001", "vr-abc123def456789", repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "verified");
    assert.equal(result.lifecycle.verification_result_id, "vr-abc123def456789");
    assert.equal(result.lifecycle.execution_granted, false);
    assert.equal(result.warnings.length, 0);
  }
});

test("verifyProposalOutcome: rejects non-executing state", () => {
  for (const state of ["detected", "approved", "staged"] as const) {
    const repo = freshRepo([makeLifecycle({ state })]);
    const result = verifyProposalOutcome("lifecycle-test0000000001", "vr-abc123", repo);
    assert.equal(result.ok, false, `expected failure from state '${state}'`);
    if (!result.ok) {
      assert.ok(result.errors[0].includes("requires state 'executing'"));
    }
  }
});

test("verifyProposalOutcome: rejects empty verificationResultId", () => {
  const repo = freshRepo([makeLifecycle({ state: "executing" })]);
  const result = verifyProposalOutcome("lifecycle-test0000000001", "", repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("non-empty"));
  }
});

test("verifyProposalOutcome: unknown lifecycleId returns error", () => {
  const repo = freshRepo();
  const result = verifyProposalOutcome("lifecycle-nonexistent", "vr-abc123", repo);
  assert.equal(result.ok, false);
});

// ── failProposalExecution ─────────────────────────────────────────────────────

test("failProposalExecution: executing → failed with rollback=false", () => {
  const repo = freshRepo([makeLifecycle({ state: "executing" })]);
  const result = failProposalExecution("lifecycle-test0000000001", "Target unreachable.", false, repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "failed");
    assert.equal(result.lifecycle.failure_reason, "Target unreachable.");
    assert.equal(result.lifecycle.execution_granted, false);
    assert.equal(result.warnings.length, 0);
  }
});

test("failProposalExecution: executing → rolled_back with rollback=true", () => {
  const repo = freshRepo([makeLifecycle({ state: "executing" })]);
  const result = failProposalExecution("lifecycle-test0000000001", "Safe state restored.", true, repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lifecycle.state, "rolled_back");
    assert.equal(result.lifecycle.failure_reason, "Safe state restored.");
    assert.ok(result.warnings.some((w) => w.includes("rolled_back")));
  }
});

test("failProposalExecution: rejects non-executing state", () => {
  for (const state of ["detected", "approved", "proposed"] as const) {
    const repo = freshRepo([makeLifecycle({ state })]);
    const result = failProposalExecution("lifecycle-test0000000001", "reason", false, repo);
    assert.equal(result.ok, false, `expected failure from state '${state}'`);
    if (!result.ok) {
      assert.ok(result.errors[0].includes("requires state 'executing'"));
    }
  }
});

test("failProposalExecution: rejects empty failureReason", () => {
  const repo = freshRepo([makeLifecycle({ state: "executing" })]);
  const result = failProposalExecution("lifecycle-test0000000001", "   ", false, repo);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors[0].includes("non-empty"));
  }
});

test("failProposalExecution: unknown lifecycleId returns error", () => {
  const repo = freshRepo();
  const result = failProposalExecution("lifecycle-nonexistent", "reason", false, repo);
  assert.equal(result.ok, false);
});

// ── Repository isolation ──────────────────────────────────────────────────────

test("fresh repo mutations do not affect default repo", () => {
  const isolated = freshRepo([makeLifecycle({ state: "detected" })]);
  transitionLifecycle("lifecycle-test0000000001", "analyzed", null, isolated);
  // Default repo should still have the fixture in its original state
  const allDefault = listLifecycles({ state: "detected" });
  assert.ok(allDefault.length >= 1, "default repo should still have detected fixture");
});

test("repo.save returns a copy, not the same reference", () => {
  const repo = freshRepo([makeLifecycle({ state: "detected" })]);
  const result = transitionLifecycle("lifecycle-test0000000001", "analyzed", null, repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    // Mutating state_history on the returned lifecycle should not corrupt the repo
    const lc = result.lifecycle;
    const originalLength = lc.state_history.length;
    (lc.state_history as LifecycleStateHistoryEntry[]).push({
      from_state: "analyzed",
      to_state: "proposed",
      transitioned_at: "2026-05-11T00:00:00.000Z",
      reason: null,
    });
    const fetched = repo.findById("lifecycle-test0000000001");
    assert.equal(fetched?.state_history.length, originalLength, "repo copy should not be mutated");
  }
});

// ── VALID_TRANSITIONS completeness ────────────────────────────────────────────

test("VALID_TRANSITIONS covers all non-terminal states", () => {
  const nonTerminal: ProposalLifecycleState[] = [
    "detected", "analyzed", "proposed", "staged", "approved", "executing",
  ];
  for (const state of nonTerminal) {
    const edges = VALID_TRANSITIONS.get(state);
    assert.ok(edges !== undefined, `VALID_TRANSITIONS missing entry for '${state}'`);
    assert.ok((edges as ReadonlyArray<string>).length > 0, `'${state}' has no valid transitions`);
  }
});

test("VALID_TRANSITIONS does not define entries for terminal states", () => {
  for (const terminal of TERMINAL_STATES) {
    const edges = VALID_TRANSITIONS.get(terminal);
    assert.equal(
      edges,
      undefined,
      `terminal state '${terminal}' should not have transitions`,
    );
  }
});
