# ADR: Phase 10.3 — Verification Engine Design

**Status**: Accepted  
**Date**: 2026-05-11  
**Deciders**: Robert (product), Claude (implementation)

---

## Context

After an operator confirms execution in the Phase 10.1 lifecycle (`approved → executing`), the system needs a way to assess whether the underlying reliability problem improved. This is the verification step that closes the loop on the proposal lifecycle (`executing → verified | failed`).

The verification engine must:
- Answer "did the remediation work?" without implying Reliai executed live changes
- Be read-only (no production mutations)
- Produce structured, auditable results with operator-reviewable rationale
- Operate entirely from snapshots — no live service calls, no async workers

---

## Decision

### Pure snapshot-based classification

Inputs are two `TraceMetricWindow` structs (before/after), a `RegressionSignature` (what regression was detected), and an `IncidentTrend` (was the incident resolved). These are deterministic inputs that can be captured at workflow time and replayed.

**Rejected alternative — live telemetry query**: Calling the trace API at verification time would introduce network dependency and make the system harder to test. Snapshot inputs keep the engine pure and testable.

### Five-outcome discriminated type

```typescript
type VerificationOutcome =
  | "recovered" | "partial_recovery" | "no_change"
  | "regressed" | "verification_failed"
```

This explicitly covers every meaningful result including failure to verify. A boolean `passed/failed` was rejected because it collapses three distinct positive states (recovered, partial, no_change) into one, losing information that operators need for follow-up decisions.

**Rejected alternative — three outcomes (improved/unchanged/worse)**: Doesn't distinguish the telemetry-unavailable case from a genuine no_change, and doesn't distinguish partial recovery from full recovery.

### Threshold-based classification over ML scoring

Classification uses five numeric thresholds (`MINIMUM_REQUEST_COUNT`, `SIGNIFICANT_IMPROVEMENT_PP`, etc.) defined as named constants. This is:
- Auditable: every decision can be explained in terms of the constants
- Tunable: Phase 11 can move constants to per-org config
- Testable: deterministic given the same inputs

**Rejected alternative — Phase 10.4 reliability score as input**: The reliability scorer (Phase 10.4) is a separate concern — it aggregates across incidents and time. The verification engine is local to one proposal lifecycle. Using a composite score would make the verification result harder to explain to operators.

### Lookup by `lifecycle_id`, not `result_id`

`VerificationResultRepository.findByLifecycleId()` uses `lifecycle_id` as the primary key. The `result_id` is carried for auditability and cross-reference, but the operations-timeline layer looks up by lifecycle context.

This is more stable because the `lifecycle_id` is established at incident detection, while `result_id` is computed at verification time.

### Standalone fixture entries for partial_recovery / no_change / verification_failed

The Phase 10.1 fixture lifecycles only have `verified` and `failed` terminal states. Partial recovery and telemetry failure scenarios have no matching lifecycle. Rather than add lifecycle fixtures to cover these (which would pollute the 10-fixture lifecycle set), standalone `VerificationResultRecord` fixtures are added to the engine, and `getOperationsSurfaceData()` generates standalone timeline entries for them.

This keeps the two fixture sets independent and avoids coupling lifecycle fixture count to verification scenario count.

### No `import "server-only"` in verification-engine.ts

`operations-timeline.ts` (the Next.js server layer) carries `import "server-only"`. The verification engine is a pure computation library with no Next.js dependency — consistent with `proposal-lifecycle.ts` and the Phase 9 assisted-automation files, which also don't carry this guard. The server-only boundary is enforced at the page layer, not the library layer.

---

## Consequences

**Good**:
- All 5 outcomes fully exercised in fixture data
- `requires_operator_review: true` enforced as literal type on every result
- Engine is fully testable with `tsx --test` (29 tests, no mocking required)
- Classification rationale is a human-readable string — directly surfaced in the Operations Center timeline
- Gate checks give operators a structured breakdown of what passed/failed

**Accepted trade-offs**:
- Before/after windows are fixture-backed in Phase 10; Phase 11 must wire real trace metric queries
- Single-metric classification (error rate primary, latency in gate checks only) is a simplification; multi-signal classification is a Phase 11 extension point
- `lifecycle_id` lookup means one lifecycle can only have one verification result — Phase 11 may need to support re-verification after rollback

---

## Phase 11 Extension Points

- Replace `InMemoryVerificationResultRepository` with a DB-backed implementation
- Replace fixture `TraceMetricWindow` inputs with live queries against `trace_metrics`
- Move classification thresholds to organization-level configuration
- Expand to multi-signal classification (error rate + latency + incident resolution combined score)
- Support re-verification after rollback (`rolled_back → verified | failed` path)
