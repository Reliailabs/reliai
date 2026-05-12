import assert from "node:assert/strict";
import test from "node:test";

import {
  computeReliabilityScore,
  getReliabilityScore,
  type ReliabilityScoringInput,
  type LifecycleStateCounts,
  type VerificationOutcomeCounts,
} from "../lib/reliability-scoring";
import type { OperationsSurfaceData } from "../components/dashboard/pulse-types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeStateCounts(overrides: Partial<LifecycleStateCounts> = {}): LifecycleStateCounts {
  return {
    detected: 0,
    analyzed: 0,
    proposed: 0,
    staged: 0,
    approved: 0,
    executing: 0,
    verified: 0,
    failed: 0,
    rolled_back: 0,
    expired: 0,
    ...overrides,
  };
}

function makeOutcomeCounts(overrides: Partial<VerificationOutcomeCounts> = {}): VerificationOutcomeCounts {
  return {
    recovered: 0,
    partial_recovery: 0,
    no_change: 0,
    regressed: 0,
    verification_failed: 0,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ReliabilityScoringInput> = {}): ReliabilityScoringInput {
  return {
    organization_id: "org-test",
    state_counts: makeStateCounts({ verified: 10 }),
    total_proposals: 10,
    operator_confirmed_proposals: 10,
    verification_outcomes: makeOutcomeCounts({ recovered: 8, partial_recovery: 2 }),
    total_verifications: 10,
    kill_switch_count: 0,
    gate_denial_count: 0,
    ...overrides,
  };
}

const FIXED_NOW = new Date("2026-05-11T12:00:00.000Z");

// ── Shape and invariants ──────────────────────────────────────────────────────

test("computeReliabilityScore returns required ReliabilityScore shape", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.equal(typeof result.operationalScore,     "number");
  assert.equal(typeof result.automationConfidence, "number");
  assert.equal(typeof result.recoveryPerformance,  "number");
  assert.equal(typeof result.policySafetyScore,    "number");
});

test("computeReliabilityScore result has requires_operator_review: true", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.equal(result.requires_operator_review, true);
});

test("computeReliabilityScore result has score_id prefixed with 'score-'", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.ok(result.score_id.startsWith("score-"), `score_id was: ${result.score_id}`);
});

test("computeReliabilityScore all numeric scores are in range 0-100", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const fields = [
    result.operationalScore,
    result.automationConfidence,
    result.recoveryPerformance,
    result.policySafetyScore,
    result.overall,
  ];
  for (const v of fields) {
    assert.ok(v >= 0 && v <= 100, `score out of range: ${v}`);
  }
});

test("computeReliabilityScore dimensions match top-level numeric values", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.equal(result.operationalScore,     result.dimensions.operationalScore.score);
  assert.equal(result.automationConfidence, result.dimensions.automationConfidence.score);
  assert.equal(result.recoveryPerformance,  result.dimensions.recoveryPerformance.score);
  assert.equal(result.policySafetyScore,    result.dimensions.policySafetyScore.score);
});

test("each dimension has grade and 3 factors", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const dims = [
    result.dimensions.operationalScore,
    result.dimensions.automationConfidence,
    result.dimensions.recoveryPerformance,
    result.dimensions.policySafetyScore,
  ];
  for (const dim of dims) {
    assert.ok(["A","B","C","D","F"].includes(dim.grade), `unexpected grade: ${dim.grade}`);
    assert.equal(dim.factors.length, 3);
  }
});

test("each factor has non-empty rationale", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const allFactors = [
    ...result.dimensions.operationalScore.factors,
    ...result.dimensions.automationConfidence.factors,
    ...result.dimensions.recoveryPerformance.factors,
    ...result.dimensions.policySafetyScore.factors,
  ];
  for (const f of allFactors) {
    assert.ok(f.rationale.length > 10, `factor '${f.name}' has empty rationale`);
  }
});

test("factor weights within each dimension sum to 1.0", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  for (const [key, dim] of Object.entries(result.dimensions)) {
    const sum = dim.factors.reduce((s, f) => s + f.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `${key} factor weights sum to ${sum}`);
  }
});

test("factor contribution equals value * weight (to 1dp)", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const allFactors = [
    ...result.dimensions.operationalScore.factors,
    ...result.dimensions.automationConfidence.factors,
    ...result.dimensions.recoveryPerformance.factors,
    ...result.dimensions.policySafetyScore.factors,
  ];
  for (const f of allFactors) {
    const expected = Math.round(f.value * f.weight * 10) / 10;
    assert.ok(
      Math.abs(f.contribution - expected) < 0.2,
      `factor '${f.name}': contribution ${f.contribution} expected ~${expected}`,
    );
  }
});

// ── Trend ─────────────────────────────────────────────────────────────────────

test("trend has 7 points", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.equal(result.trend.length, 7);
});

test("trend last point date is today", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const today = FIXED_NOW.toISOString().slice(0, 10);
  assert.equal(result.trend[6]?.date, today);
});

test("trend first point date is 6 days ago", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const sixDaysAgo = new Date(FIXED_NOW);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  assert.equal(result.trend[0]?.date, sixDaysAgo.toISOString().slice(0, 10));
});

test("trend overall values are in range 0-100", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  for (const point of result.trend) {
    assert.ok(point.overall >= 0 && point.overall <= 100, `trend overall out of range: ${point.overall}`);
  }
});

test("trend last point matches current overall score", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.equal(result.trend[6]?.overall, result.overall);
});

test("trend is generally improving (oldest ≤ newest overall)", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  assert.ok(
    (result.trend[0]?.overall ?? 0) <= (result.trend[6]?.overall ?? 0),
    `expected improving trend: ${result.trend.map((p) => p.overall).join(",")}`,
  );
});

// ── Grade thresholds ──────────────────────────────────────────────────────────

test("overall score 90+ earns grade A", () => {
  const result = computeReliabilityScore(
    makeInput({
      state_counts: makeStateCounts({ verified: 100 }),
      total_proposals: 100,
      operator_confirmed_proposals: 100,
      total_verifications: 100,
      verification_outcomes: makeOutcomeCounts({ recovered: 100 }),
      kill_switch_count: 0,
      gate_denial_count: 0,
    }),
    FIXED_NOW,
  );
  assert.ok(result.overall >= 90, `expected ≥90, got ${result.overall}`);
  assert.equal(result.overall_grade, "A");
});

test("kill_switch_count 0 gives kill_switch_absence factor value of 100", () => {
  const result = computeReliabilityScore(makeInput({ kill_switch_count: 0 }), FIXED_NOW);
  const ksf = result.dimensions.policySafetyScore.factors.find((f) => f.name === "kill_switch_absence");
  assert.ok(ksf !== undefined, "kill_switch_absence factor not found");
  assert.equal(ksf.value, 100);
});

test("kill_switch_count 1 gives kill_switch_absence factor value of 80", () => {
  const result = computeReliabilityScore(makeInput({ kill_switch_count: 1 }), FIXED_NOW);
  const ksf = result.dimensions.policySafetyScore.factors.find((f) => f.name === "kill_switch_absence");
  assert.ok(ksf !== undefined, "kill_switch_absence factor not found");
  assert.equal(ksf.value, 80);
});

test("safety_boundary_compliance factor is always 100", () => {
  const result = computeReliabilityScore(makeInput(), FIXED_NOW);
  const sbf = result.dimensions.policySafetyScore.factors.find((f) => f.name === "safety_boundary_compliance");
  assert.ok(sbf !== undefined, "safety_boundary_compliance factor not found");
  assert.equal(sbf.value, 100);
});

// ── Deterministic IDs ─────────────────────────────────────────────────────────

test("score_id is deterministic given same organization_id and now", () => {
  const r1 = computeReliabilityScore(makeInput({ organization_id: "org-det-test" }), FIXED_NOW);
  const r2 = computeReliabilityScore(makeInput({ organization_id: "org-det-test" }), FIXED_NOW);
  assert.equal(r1.score_id, r2.score_id);
});

test("score_id differs for different organizations", () => {
  const r1 = computeReliabilityScore(makeInput({ organization_id: "org-aaa" }), FIXED_NOW);
  const r2 = computeReliabilityScore(makeInput({ organization_id: "org-bbb" }), FIXED_NOW);
  assert.notEqual(r1.score_id, r2.score_id);
});

// ── Fixture data via getReliabilityScore() ────────────────────────────────────

test("getReliabilityScore returns all 4 numeric dimension scores", () => {
  const result = getReliabilityScore(FIXED_NOW);
  assert.equal(typeof result.operationalScore,     "number");
  assert.equal(typeof result.automationConfidence, "number");
  assert.equal(typeof result.recoveryPerformance,  "number");
  assert.equal(typeof result.policySafetyScore,    "number");
});

test("getReliabilityScore fixture produces operationalScore ≈ 81", () => {
  const result = getReliabilityScore(FIXED_NOW);
  assert.ok(
    result.operationalScore >= 78 && result.operationalScore <= 84,
    `expected ~81, got ${result.operationalScore}`,
  );
});

test("getReliabilityScore fixture produces automationConfidence ≈ 88", () => {
  const result = getReliabilityScore(FIXED_NOW);
  assert.ok(
    result.automationConfidence >= 85 && result.automationConfidence <= 91,
    `expected ~88, got ${result.automationConfidence}`,
  );
});

test("getReliabilityScore fixture produces recoveryPerformance ≈ 64", () => {
  const result = getReliabilityScore(FIXED_NOW);
  assert.ok(
    result.recoveryPerformance >= 61 && result.recoveryPerformance <= 67,
    `expected ~64, got ${result.recoveryPerformance}`,
  );
});

test("getReliabilityScore fixture produces overall score ≈ 80 with grade B", () => {
  const result = getReliabilityScore(FIXED_NOW);
  assert.ok(
    result.overall >= 77 && result.overall <= 83,
    `expected ~80, got ${result.overall}`,
  );
  assert.equal(result.overall_grade, "B");
});

// ── Recovery dimension edge cases ─────────────────────────────────────────────

test("100% regressed outcomes gives recoveryPerformance a low score", () => {
  const result = computeReliabilityScore(
    makeInput({
      verification_outcomes: makeOutcomeCounts({ regressed: 10 }),
      total_verifications: 10,
    }),
    FIXED_NOW,
  );
  assert.ok(result.recoveryPerformance < 40, `expected low recovery score, got ${result.recoveryPerformance}`);
});

test("0 total_verifications does not crash (vacuous safe denominator)", () => {
  const result = computeReliabilityScore(
    makeInput({
      verification_outcomes: makeOutcomeCounts(),
      total_verifications: 0,
    }),
    FIXED_NOW,
  );
  assert.equal(typeof result.recoveryPerformance, "number");
  assert.ok(result.recoveryPerformance >= 0 && result.recoveryPerformance <= 100);
});

test("0 total_proposals does not crash", () => {
  const result = computeReliabilityScore(
    makeInput({
      state_counts: makeStateCounts(),
      total_proposals: 0,
      operator_confirmed_proposals: 0,
    }),
    FIXED_NOW,
  );
  assert.equal(typeof result.operationalScore, "number");
  assert.ok(result.operationalScore >= 0 && result.operationalScore <= 100);
});

// ── OperationsSurfaceData shape compatibility ─────────────────────────────────

test("getReliabilityScore() result satisfies OperationsSurfaceData['reliabilityScore'] shape", () => {
  const score = getReliabilityScore();

  // Type-level: assigning to the expected surface field type must compile.
  // If this assignment fails tsc it means the lib type diverged from the surface type.
  const field: OperationsSurfaceData["reliabilityScore"] = score;

  // Runtime assertions that the panel will have something to render.
  assert.ok(
    field.overall >= 0 && field.overall <= 100,
    "overall score is in render range [0, 100]",
  );
  assert.ok(
    ["A", "B", "C", "D", "F"].includes(field.overall_grade),
    "overall_grade is a renderable letter",
  );
  assert.equal(
    Object.keys(field.dimensions).length,
    4,
    "all four dimension keys present for panel grid",
  );
  const dimKeys = Object.keys(field.dimensions) as Array<keyof typeof field.dimensions>;
  for (const key of dimKeys) {
    const dim = field.dimensions[key];
    assert.ok(dim.score >= 0 && dim.score <= 100, `${key} score in range`);
    assert.ok(dim.factors.length > 0, `${key} has at least one factor for weakest-callout`);
  }
  assert.ok(field.requires_operator_review === true, "requires_operator_review literal present");
});
