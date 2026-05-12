# Phase 10.4 — Reliability Scoring

## Purpose

The Reliability Scoring engine produces an on-the-fly, explainable score that answers:

> **How reliably is the assisted automation workflow operating across the proposal lifecycle, verification outcomes, and governance controls?**

Scores are computed from Phase 10.1 lifecycle state history and Phase 10.3 verification results. They are **not persisted** — recomputed on every request. No jobs, no workers, no async DB queries, no FastAPI calls.

---

## Score Shape

```typescript
type ReliabilityScore = {
  operationalScore: number;      // 0–100
  automationConfidence: number;  // 0–100
  recoveryPerformance: number;   // 0–100
  policySafetyScore: number;     // 0–100
};
```

Each dimension is a `ScoredDimension` containing the numeric score, a letter grade, and contributing factors with rationale text.

---

## Dimensions

### operationalScore (weight: 30%)

Measures proposal pipeline throughput and health.

| Factor | Weight | Signal |
|---|---|---|
| `active_proposal_coverage` | 35% | Proposals advanced past detection and not expired / total |
| `execution_completion_rate` | 35% | Proposals reaching a terminal state from the execution window |
| `expiry_avoidance_rate` | 30% | Proposals processed before the lifecycle expiry deadline |

### automationConfidence (weight: 25%)

Measures operator engagement quality and approval accountability.

| Factor | Weight | Signal |
|---|---|---|
| `operator_approval_rate` | 40% | Staged proposals that received operator approval |
| `proposal_staging_rate` | 35% | Policy-gate-passing proposals that advanced to staging |
| `operator_confirmation_coverage` | 25% | Approved proposals with a recorded operator identity |

### recoveryPerformance (weight: 25%)

Derived from Phase 10.3 verification outcomes — answers "did remediations work?"

| Factor | Weight | Signal |
|---|---|---|
| `positive_outcome_rate` | 40% | Verified proposals with `recovered` or `partial_recovery` outcome |
| `non_regression_rate` | 35% | Verified proposals that did not produce a `regressed` outcome |
| `verification_coverage` | 25% | Execution outcomes with sufficient telemetry for classification |

### policySafetyScore (weight: 20%)

Measures governance boundary health.

| Factor | Weight | Signal |
|---|---|---|
| `gate_pass_rate` | 45% | Policy gate evaluations that passed / total evaluated |
| `kill_switch_absence` | 30% | 100 (no activations) → 80 (1) → 75 (2) → 0 floor |
| `safety_boundary_compliance` | 25% | Always 100 — `execution_granted: false` + `requires_operator_review: true` are compile-time literals |

---

## Overall Score

```
overall = operationalScore × 0.30
        + automationConfidence × 0.25
        + recoveryPerformance × 0.25
        + policySafetyScore × 0.20
```

Grade scale: **A** ≥ 90 · **B** ≥ 75 · **C** ≥ 60 · **D** ≥ 45 · **F** < 45

---

## Fixture Scores (from Phase 10.1 + 10.3 fixture data)

| Dimension | Score | Grade | Signal driving the score |
|---|---|---|---|
| operationalScore | 81 | B | 8/10 active proposals; 3/4 executions complete; 1 expiry |
| automationConfidence | 88 | B | 5/6 staged proposals approved; all have operator identity |
| recoveryPerformance | 64 | C | 2/5 positive outcomes; 1 regression; 1 telemetry failure |
| policySafetyScore | 88 | B | 7/8 gates passed; 1 kill switch activation |
| **overall** | **80** | **B** | Recovery is the drag — intentional, realistic fixture |

---

## Explainability

Every `ScoreFactor` carries:
- `name` — machine-readable identifier
- `label` — human-readable name for display
- `value` — raw score 0–100 for this factor
- `weight` — fraction of dimension score contributed
- `contribution` — `value × weight` (pre-computed)
- `rationale` — plain-English explanation referencing actual counts

Example from `recoveryPerformance`:
```
positive_outcome_rate: 40/100
"2 of 5 verified proposals showed positive recovery
 (1 recovered, 1 partial). Positive outcome rate: 40%."
```

---

## Trend

A 7-day `TrendPoint[]` sparkline is included in every `ReliabilityScoreRecord`. Points are computed deterministically from the current score using fixed per-day deltas (−8pp on day −6, improving to 0pp today). Not persisted.

```typescript
type TrendPoint = {
  date: string;               // YYYY-MM-DD
  overall: number;
  operationalScore: number;
  automationConfidence: number;
  recoveryPerformance: number;
  policySafetyScore: number;
};
```

---

## Service API

```typescript
// Pure computation — no I/O. Takes a ReliabilityScoringInput, returns a scored record.
function computeReliabilityScore(
  input: ReliabilityScoringInput,
  now?: Date,
): ReliabilityScoreRecord

// Builds input from Phase 10.1 + 10.3 default repositories and computes.
function getReliabilityScore(now?: Date): ReliabilityScoreRecord
```

`computeReliabilityScore` is fully testable without any repository or framework dependency. `getReliabilityScore` is the public integration point called by `getOperationsSurfaceData()`.

---

## Integration

`OperationsSurfaceData` in `pulse-types.ts` gains:

```typescript
reliabilityScore: ReliabilityScoreRecord;
```

`getOperationsSurfaceData()` in `lib/operations-timeline.ts` calls `getReliabilityScore()` and includes it in the response alongside the timeline entries.

---

## Implementation Files

| File | Role |
|---|---|
| `apps/pulse/lib/reliability-scoring.ts` | All scoring logic — dimensions, factors, trend, service functions |
| `apps/pulse/tests/reliability-scoring.test.ts` | 29 tests covering shape, grades, factors, trend, fixture values |
| `apps/pulse/components/dashboard/pulse-types.ts` | `ReliabilityScore`, `ScoreFactor`, `ScoredDimension`, `TrendPoint`, `ReliabilityScoreRecord` types; `OperationsSurfaceData.reliabilityScore` |
| `apps/pulse/lib/operations-timeline.ts` | Calls `getReliabilityScore()`, adds to surface data |

---

## Phase 11 Extension Points

1. **Persist scores**: write computed records to a `reliability_scores` table; Phase 11 substitutes `getReliabilityScore()` with a cached/persisted version.
2. **Real trend**: replace the deterministic 7-day approximation with actual historical score snapshots from the DB.
3. **Organization-level thresholds**: make dimension weights and grade boundaries configurable per org.
4. **Governance event counts**: replace `FIXTURE_KILL_SWITCH_COUNT` / `FIXTURE_GATE_DENIAL_COUNT` constants with a live query against `operations_timeline_events`.
5. **More dimensions**: add `deployment_health`, `trace_quality`, `guardrail_coverage` to the composite when those signals are available.
