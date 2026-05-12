# Phase 10.3 — Verification Engine

## Purpose

The Verification Engine answers one question after a supervised remediation workflow completes:

> **Did the remediation work?**

It compares trace metric snapshots from before and after an operator-confirmed execution boundary and classifies the outcome into one of five categories. It is **read-only** — it consumes metric snapshots and emits a structured result. It does not execute production changes, trigger rollbacks, or call external services.

---

## Core Invariant

The Verification Engine enforces the same governance boundary as the rest of Phase 10:

- `requires_operator_review: true` is a TypeScript literal on every `VerificationResultRecord`
- No `execution_granted` field is evaluated — verification is post-execution observation only
- No automatic remediation or rollback is triggered from a verification result
- All verification inputs are read-only metric snapshots, not live system handles

---

## Outcome Types

```typescript
type VerificationOutcome =
  | "recovered"           // error rate dropped ≥ 5pp — clear positive signal
  | "partial_recovery"    // error rate dropped 1–4.9pp — improvement but not complete
  | "no_change"           // delta within ±1pp noise band — no measurable effect
  | "regressed"           // error rate increased ≥ 2pp — remediation made things worse
  | "verification_failed" // after-window request count < 50 — insufficient telemetry
```

---

## Classification Logic

Inputs: `before_window.error_rate_pct`, `after_window.error_rate_pct`, `after_window.request_count`.

```
if after_window.request_count < 50          → verification_failed
else if (before - after) ≥ 5.0pp           → recovered
else if (before - after) ≥ 1.0pp           → partial_recovery
else if (after - before) ≥ 2.0pp           → regressed
else                                         → no_change
```

### Thresholds (constants in `lib/verification-engine.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `MINIMUM_REQUEST_COUNT` | 50 | Min after-window requests for a valid signal |
| `SIGNIFICANT_IMPROVEMENT_PP` | 5.0 | Error rate drop required for `recovered` |
| `PARTIAL_RECOVERY_PP` | 1.0 | Error rate drop required for `partial_recovery` |
| `SIGNIFICANT_DEGRADATION_PP` | 2.0 | Error rate increase required for `regressed` |
| `NOISE_BAND_PP` | 1.0 | Delta within this band → `no_change` |

### Confidence levels

| Outcome | Condition | Confidence |
|---|---|---|
| `recovered` | `after_window.request_count ≥ 500` | `high` |
| `recovered` | `after_window.request_count ≥ 200` | `medium` |
| `recovered` | `after_window.request_count < 200` | `low` |
| `partial_recovery` | always | `medium` |
| `no_change` | always | `medium` |
| `regressed` | always | `high` |
| `verification_failed` | always | `low` |

---

## Input Schema

```typescript
type VerificationInput = {
  lifecycle_id: string;
  proposal_id: string;
  before_window: TraceMetricWindow;
  after_window: TraceMetricWindow;
  regression_signature: RegressionSignature;
  incident_trend: IncidentTrend;
};

type TraceMetricWindow = {
  window_start: string;  // ISO 8601
  window_end: string;
  request_count: number;
  error_rate_pct: number;   // 0–100
  p99_latency_ms: number;
  p50_latency_ms: number;
};

type RegressionSignature = {
  regression_id: string;
  detected_at: string;
  error_rate_delta_pp: number;  // pp above baseline at detection
  latency_regression_pct: number;
};

type IncidentTrend = {
  incident_id: string;
  severity: "critical" | "high" | "medium" | "low";
  open_at: string;
  resolved_at: string | null;
};
```

All inputs validated via Zod. `runVerification` returns `{ ok: false; errors; warnings }` on validation failure.

---

## Output Shape

```typescript
type VerificationResultRecord = {
  readonly result_id: string;              // "vr-" + 16-char sha256 hex
  readonly lifecycle_id: string;
  readonly proposal_id: string;
  readonly outcome: VerificationOutcome;
  readonly confidence: "low" | "medium" | "high";
  readonly rationale: string;              // human-readable classification narrative
  readonly error_rate_before_pct: number;
  readonly error_rate_after_pct: number;
  readonly error_rate_delta_pp: number;    // after - before (negative = improvement)
  readonly latency_p99_before_ms: number;
  readonly latency_p99_after_ms: number;
  readonly latency_delta_pct: number;
  readonly gate_checks: GateCheck[];       // 5 named checks, each passed/failed
  readonly computed_at: string;
  readonly requires_operator_review: true; // literal — never boolean
};
```

### Gate checks (5, always present)

| Name | Passes when |
|---|---|
| `adequate_telemetry_sample` | `after_window.request_count ≥ 50` |
| `no_latency_regression` | `after_p99 ≤ before_p99 × 1.2` |
| `incident_resolved` | `incident_trend.resolved_at !== null` |
| `error_rate_not_worse` | `after_error_rate ≤ before_error_rate + 1.0pp` |
| `outcome_not_failure` | outcome is not `regressed` or `verification_failed` |

---

## Service Functions

```typescript
// Validate input, classify outcome, persist result. Pure computation — no side effects.
function runVerification(
  payload: unknown,
  repo?: VerificationResultRepository,
  now?: Date,
): VerificationRunResult

// Look up by lifecycle_id. Used by Operations Center timeline enrichment.
function getVerificationResultByLifecycleId(
  lifecycleId: string,
  repo?: VerificationResultRepository,
): VerificationResultRecord | null

// Return all results. Used by Operations Center for standalone entry generation.
function listVerificationResults(
  repo?: VerificationResultRepository,
): VerificationResultRecord[]
```

---

## Fixture Scenarios

Five deterministic fixture records cover every outcome:

| Scenario | Lifecycle | Outcome | Signal |
|---|---|---|---|
| 1 | `lifecycle-7e728a4e7e2d4f1a` (verified) | `recovered` | error rate 15.0% → 0.5% |
| 2 | `lifecycle-partial-demo-001` (standalone) | `partial_recovery` | error rate 12.0% → 8.0% |
| 3 | `lifecycle-14faf95b97602667` (executing) | `no_change` | error rate 3.0% → 2.8% |
| 4 | `lifecycle-c84051b28a326d08` (failed) | `regressed` | error rate 2.0% → 6.0% |
| 5 | `lifecycle-telemetry-fail-001` (standalone) | `verification_failed` | after count = 12 |

---

## Integration with Operations Center

`getOperationsSurfaceData()` in `lib/operations-timeline.ts` calls `listVerificationResults()` after building lifecycle-derived entries, then:

1. **Enriches** existing `verification_result` entries (those derived from `executing → verified` or `executing → failed` transitions) with outcome-specific titles and the engine's rationale string.
2. **Adds standalone entries** for verification results whose `lifecycle_id` has no matching lifecycle transition (e.g., partial_recovery, verification_failed fixtures).

The enrichment is additive and non-destructive — if no matching result exists for a lifecycle, the entry retains its original summary.

---

## Persistence Boundary

```typescript
interface VerificationResultRepository {
  findByLifecycleId(lifecycleId: string): VerificationResultRecord | null;
  findAll(): VerificationResultRecord[];
  save(record: VerificationResultRecord): VerificationResultRecord;
}
```

Phase 10 ships `InMemoryVerificationResultRepository` (fixture-backed). Phase 11 substitutes a DB-backed implementation at the `defaultRepository` assignment in `lib/verification-engine.ts`.

---

## Implementation Files

| File | Role |
|---|---|
| `apps/pulse/lib/verification-engine.ts` | Zod schemas, classification logic, repository, fixtures, service functions |
| `apps/pulse/tests/verification-engine.test.ts` | 29 tests covering all outcomes, validation, confidence levels, repo isolation |
| `apps/pulse/lib/operations-timeline.ts` | Imports `listVerificationResults`, enriches timeline entries |
| `docs/adr/phase10-verification-engine.md` | Decision record |

---

## Phase 11 Extension Points

1. **Real inputs**: replace fixture `TraceMetricWindow` snapshots with live queries against `trace_metrics` table (or Phase 9 trace data).
2. **Real persistence**: replace `InMemoryVerificationResultRepository` with a DB-backed query against `verification_results` table.
3. **Threshold configuration**: move `MINIMUM_REQUEST_COUNT`, `SIGNIFICANT_IMPROVEMENT_PP` etc. to organization-level configuration.
4. **Multi-signal classification**: incorporate p99 latency trend and incident resolution state into the primary classification (currently gate checks only).
5. **Operator notification**: emit a structured event to the Operations Center when `regressed` is classified, surfacing it as an urgent review item.
