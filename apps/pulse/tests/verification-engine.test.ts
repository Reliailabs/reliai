import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryVerificationResultRepository,
  runVerification,
  getVerificationResultByLifecycleId,
  listVerificationResults,
  type VerificationInput,
  type VerificationResultRecord,
} from "../lib/verification-engine";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<VerificationInput> = {}): VerificationInput {
  return {
    lifecycle_id: "lifecycle-test0000000001",
    proposal_id: "phase9-test-verif-0000001",
    before_window: {
      window_start: "2026-05-10T08:00:00.000Z",
      window_end: "2026-05-10T09:00:00.000Z",
      request_count: 500,
      error_rate_pct: 12.0,
      p99_latency_ms: 800,
      p50_latency_ms: 180,
    },
    after_window: {
      window_start: "2026-05-10T10:00:00.000Z",
      window_end: "2026-05-10T11:00:00.000Z",
      request_count: 520,
      error_rate_pct: 0.5,
      p99_latency_ms: 210,
      p50_latency_ms: 90,
    },
    regression_signature: {
      regression_id: "reg-test-001",
      detected_at: "2026-05-10T07:55:00.000Z",
      error_rate_delta_pp: 10.0,
      latency_regression_pct: 60.0,
    },
    incident_trend: {
      incident_id: "inc-test-001",
      severity: "high",
      open_at: "2026-05-10T07:50:00.000Z",
      resolved_at: "2026-05-10T09:45:00.000Z",
    },
    ...overrides,
  };
}

function freshRepo(records: VerificationResultRecord[] = []): InMemoryVerificationResultRepository {
  return new InMemoryVerificationResultRepository(records);
}

// ── Fixture data ──────────────────────────────────────────────────────────────

test("listVerificationResults returns all 5 fixture entries", () => {
  const results = listVerificationResults();
  assert.equal(results.length, 5);
});

test("fixture covers all 5 VerificationOutcome values", () => {
  const results = listVerificationResults();
  const outcomes = new Set(results.map((r) => r.outcome));
  assert.ok(outcomes.has("recovered"),            "missing: recovered");
  assert.ok(outcomes.has("partial_recovery"),     "missing: partial_recovery");
  assert.ok(outcomes.has("no_change"),            "missing: no_change");
  assert.ok(outcomes.has("regressed"),            "missing: regressed");
  assert.ok(outcomes.has("verification_failed"),  "missing: verification_failed");
});

test("all fixture records have requires_operator_review: true", () => {
  const results = listVerificationResults();
  for (const r of results) {
    assert.equal(r.requires_operator_review, true, `${r.result_id} missing requires_operator_review`);
  }
});

test("all fixture records have result_id prefixed with 'vr-'", () => {
  const results = listVerificationResults();
  for (const r of results) {
    assert.ok(r.result_id.startsWith("vr-"), `result_id '${r.result_id}' missing 'vr-' prefix`);
  }
});

test("all fixture records have 5 gate_checks", () => {
  const results = listVerificationResults();
  for (const r of results) {
    assert.equal(r.gate_checks.length, 5, `${r.result_id} has ${r.gate_checks.length} gate checks`);
  }
});

test("getVerificationResultByLifecycleId returns fixture record for known lifecycle", () => {
  const result = getVerificationResultByLifecycleId("lifecycle-7e728a4e7e2d4f1a");
  assert.ok(result !== null, "expected record for lifecycle-7e728a4e7e2d4f1a");
  assert.equal(result.outcome, "recovered");
  assert.equal(result.proposal_id, "phase9-inc-0708091011120007");
});

test("getVerificationResultByLifecycleId returns null for unknown lifecycle", () => {
  const result = getVerificationResultByLifecycleId("lifecycle-does-not-exist");
  assert.equal(result, null);
});

// ── runVerification — input validation ────────────────────────────────────────

test("runVerification rejects empty payload", () => {
  const repo = freshRepo();
  const result = runVerification({}, repo);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("runVerification rejects missing lifecycle_id", () => {
  const repo = freshRepo();
  const input = makeInput();
  const { lifecycle_id: _, ...withoutId } = input;
  const result = runVerification(withoutId, repo);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("lifecycle_id")));
});

test("runVerification rejects negative error_rate_pct", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({ before_window: { ...makeInput().before_window, error_rate_pct: -1 } }),
    repo,
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("error_rate_pct")));
});

test("runVerification rejects error_rate_pct > 100", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({ after_window: { ...makeInput().after_window, error_rate_pct: 101 } }),
    repo,
  );
  assert.equal(result.ok, false);
});

// ── runVerification — outcome classification ──────────────────────────────────

test("runVerification classifies as 'recovered' when error rate drops ≥ 5pp", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 15.0, request_count: 500 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 0.5,  request_count: 520 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "recovered");
  }
});

test("runVerification classifies as 'partial_recovery' when error rate drops 1–4.9pp", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 10.0, request_count: 300 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 6.5,  request_count: 310 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "partial_recovery");
  }
});

test("runVerification classifies as 'no_change' when delta is within noise band", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 3.0, request_count: 600 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 2.8, request_count: 580 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "no_change");
  }
});

test("runVerification classifies as 'regressed' when error rate increases ≥ 2pp", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 2.0, request_count: 800 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 6.0, request_count: 820 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "regressed");
  }
});

test("runVerification classifies as 'verification_failed' when after_window count < 50", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      after_window: { ...makeInput().after_window, request_count: 12 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "verification_failed");
    assert.equal(result.result.confidence, "low");
  }
});

// ── runVerification — result shape ────────────────────────────────────────────

test("runVerification result has requires_operator_review: true", () => {
  const repo = freshRepo();
  const result = runVerification(makeInput(), repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.requires_operator_review, true);
  }
});

test("runVerification result has result_id prefixed with 'vr-'", () => {
  const repo = freshRepo();
  const result = runVerification(makeInput(), repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.result.result_id.startsWith("vr-"));
  }
});

test("runVerification result contains 5 gate_checks", () => {
  const repo = freshRepo();
  const result = runVerification(makeInput(), repo);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.gate_checks.length, 5);
  }
});

test("runVerification persists result to repo — findByLifecycleId returns it", () => {
  const repo = freshRepo();
  const input = makeInput({ lifecycle_id: "lifecycle-persist-test-001" });
  const result = runVerification(input, repo);
  assert.equal(result.ok, true);
  const found = repo.findByLifecycleId("lifecycle-persist-test-001");
  assert.ok(found !== null);
  if (result.ok) {
    assert.equal(found.result_id, result.result.result_id);
  }
});

test("runVerification computes deterministic result_id from proposal_id and computed_at", () => {
  const repo1 = freshRepo();
  const repo2 = freshRepo();
  const now = new Date("2026-05-11T10:00:00.000Z");
  const input = makeInput({ proposal_id: "phase9-test-det-id-0001" });

  const r1 = runVerification(input, repo1, now);
  const r2 = runVerification(input, repo2, now);

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  if (r1.ok && r2.ok) {
    assert.equal(r1.result.result_id, r2.result.result_id);
  }
});

test("runVerification error_rate_delta_pp equals after minus before (rounded to 1dp)", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 10.0 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 3.5 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.error_rate_delta_pp, -6.5);
  }
});

// ── runVerification — warnings ────────────────────────────────────────────────

test("runVerification emits warning when before_window request_count < 50", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, request_count: 20 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.warnings.some((w) => w.includes("before_window")),
      `expected before_window warning, got: ${JSON.stringify(result.warnings)}`,
    );
  }
});

// ── InMemoryVerificationResultRepository ─────────────────────────────────────

test("InMemoryVerificationResultRepository: save and findByLifecycleId round-trip", () => {
  const repo = freshRepo();
  const record: VerificationResultRecord = {
    result_id: "vr-test000000000001",
    lifecycle_id: "lifecycle-repo-test-001",
    proposal_id: "phase9-repo-test-00001",
    outcome: "recovered",
    confidence: "high",
    rationale: "Test rationale",
    error_rate_before_pct: 10.0,
    error_rate_after_pct: 1.0,
    error_rate_delta_pp: -9.0,
    latency_p99_before_ms: 500,
    latency_p99_after_ms: 200,
    latency_delta_pct: -60.0,
    gate_checks: [],
    computed_at: "2026-05-11T10:00:00.000Z",
    requires_operator_review: true,
  };
  repo.save(record);
  const found = repo.findByLifecycleId("lifecycle-repo-test-001");
  assert.ok(found !== null);
  assert.equal(found.result_id, "vr-test000000000001");
  assert.equal(found.outcome, "recovered");
});

test("InMemoryVerificationResultRepository: findAll returns all saved records", () => {
  const repo = freshRepo();
  assert.equal(repo.findAll().length, 0);
  const r1: VerificationResultRecord = {
    result_id: "vr-test000000000002",
    lifecycle_id: "lifecycle-repo-test-002",
    proposal_id: "phase9-repo-test-00002",
    outcome: "no_change",
    confidence: "medium",
    rationale: "No change",
    error_rate_before_pct: 3.0,
    error_rate_after_pct: 3.2,
    error_rate_delta_pp: 0.2,
    latency_p99_before_ms: 300,
    latency_p99_after_ms: 310,
    latency_delta_pct: 3.3,
    gate_checks: [],
    computed_at: "2026-05-11T11:00:00.000Z",
    requires_operator_review: true,
  };
  repo.save(r1);
  assert.equal(repo.findAll().length, 1);
});

test("InMemoryVerificationResultRepository: save overwrites on same lifecycle_id", () => {
  const repo = freshRepo();
  const base: VerificationResultRecord = {
    result_id: "vr-test000000000003",
    lifecycle_id: "lifecycle-overwrite-test",
    proposal_id: "phase9-overwrite-test-01",
    outcome: "no_change",
    confidence: "medium",
    rationale: "initial",
    error_rate_before_pct: 3.0,
    error_rate_after_pct: 3.1,
    error_rate_delta_pp: 0.1,
    latency_p99_before_ms: 300,
    latency_p99_after_ms: 305,
    latency_delta_pct: 1.7,
    gate_checks: [],
    computed_at: "2026-05-11T11:00:00.000Z",
    requires_operator_review: true,
  };
  repo.save(base);
  repo.save({ ...base, outcome: "recovered", rationale: "updated" });
  const found = repo.findByLifecycleId("lifecycle-overwrite-test");
  assert.ok(found !== null);
  assert.equal(found.outcome, "recovered");
  assert.equal(found.rationale, "updated");
  assert.equal(repo.findAll().length, 1);
});

// ── confidence levels ─────────────────────────────────────────────────────────

test("recovered outcome gets high confidence when request_count ≥ 500", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 15.0, request_count: 600 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 1.0,  request_count: 600 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "recovered");
    assert.equal(result.result.confidence, "high");
  }
});

test("recovered outcome gets medium confidence when 200 ≤ request_count < 500", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 15.0, request_count: 250 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 1.0,  request_count: 250 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "recovered");
    assert.equal(result.result.confidence, "medium");
  }
});

test("regressed outcome always gets high confidence", () => {
  const repo = freshRepo();
  const result = runVerification(
    makeInput({
      before_window: { ...makeInput().before_window, error_rate_pct: 2.0, request_count: 60 },
      after_window:  { ...makeInput().after_window,  error_rate_pct: 8.0, request_count: 60 },
    }),
    repo,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.result.outcome, "regressed");
    assert.equal(result.result.confidence, "high");
  }
});
