# Phase 11.2 — Persistence Schema Design

## Purpose

Define the PostgreSQL table layout for the five Phase 10 record types so that
Phase 11.3 (FastAPI adapter boundary) has an unambiguous target. The schema is
implemented in a single Alembic migration:
`infra/db/migrations/versions/20260512_0001_phase11_operations_center.py`

---

## Design Principles

### Append-only event semantics

`operations_timeline_events`, `lifecycle_transition_history`, and
`verification_result_records` are write-once: rows are inserted, never updated.
There is no `updated_at` column on these tables; the absence is intentional and
signals the append-only invariant to future maintainers. `reliability_score_snapshots`
is also append-only (each computation produces a new row).

`proposal_lifecycle_records` is the only mutable table — lifecycle state
transitions are applied as UPDATE + INSERT into the history table.

### Idempotency keys

Every table carries an `idempotency_key` column with a `UNIQUE` constraint.
Keys are derived deterministically from business data:

| Table | Key derivation |
|---|---|
| `proposal_lifecycle_records` | `lifecycle_id` (already globally unique) |
| `lifecycle_transition_history` | `sha256(lifecycle_id + ":" + from_state + ":" + to_state + ":" + transitioned_at)` |
| `operations_timeline_events` | `entry_id` (already a deterministic sha256 hash) |
| `verification_result_records` | `result_id` (already a deterministic sha256 hash) |
| `reliability_score_snapshots` | `score_id` (already a deterministic sha256 hash) |

On conflict, the application layer uses `INSERT … ON CONFLICT (idempotency_key) DO NOTHING`
to make all writes safe to retry without duplication.

### Tenant / org / project scoping

Every table carries `organization_id UUID NOT NULL` with a foreign key to
`organizations.id` and an index. `project_id UUID NULL` is present on tables
where project-level scoping is needed (`proposal_lifecycle_records`,
`operations_timeline_events`). Queries must always filter by `organization_id`
to maintain tenant isolation.

### Immutable invariants enforced at DB level

Two Phase 10 invariants are enforced with `CHECK` constraints:

```sql
CHECK (execution_granted = FALSE)      -- lifecycle records
CHECK (requires_operator_review = TRUE) -- all five tables
```

This prevents any future code path from accidentally setting these fields to
values that would violate the governance boundary, even if the application
layer fails to enforce them.

### JSON evidence payloads

Evidence references (`evidence_refs`) and dimension factor breakdowns
(`dimensions`) are stored as `JSONB` for flexible querying. Scalar metrics
(error rates, latency values, individual dimension scores) are stored as
typed columns so they can be aggregated without parsing JSON.

### Audit receipt linkage

`proposal_lifecycle_records.audit_receipt_id` records the receipt identifier
emitted immediately after operator approval (the `receipt_emitted` timeline
event). This provides a direct pointer from the lifecycle record to its
evidence receipt without requiring a join through `operations_timeline_events`.

---

## Tables

### `proposal_lifecycle_records`

Mutable. One row per proposal lifecycle. Updated in-place on state transitions.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | Internal surrogate key |
| `lifecycle_id` | `VARCHAR(64) UNIQUE NOT NULL` | `"lifecycle-" + 16-char sha256` |
| `proposal_id` | `VARCHAR(128) NOT NULL` | Phase 9 `phase9-*` format |
| `action_type` | `VARCHAR(64) NOT NULL` | e.g. `ack`, `rollback` |
| `target_type` | `VARCHAR(64) NOT NULL` | e.g. `incident`, `deployment` |
| `target_id` | `VARCHAR(128) NOT NULL` | e.g. `inc-001` |
| `organization_id` | `UUID NOT NULL → organizations.id` | Tenant scope |
| `project_id` | `UUID NULL → projects.id` | Optional project scope |
| `state` | `VARCHAR(32) NOT NULL` | Current `ProposalLifecycleState` |
| `execution_granted` | `BOOLEAN NOT NULL DEFAULT FALSE` | `CHECK (execution_granted = FALSE)` |
| `requires_operator_review` | `BOOLEAN NOT NULL DEFAULT TRUE` | `CHECK (requires_operator_review = TRUE)` |
| `operator_email` | `VARCHAR(255) NULL` | Set when transitioning to `approved`/`executing` |
| `verification_result_id` | `VARCHAR(128) NULL` | Soft ref to `verification_result_records.result_id` |
| `audit_receipt_id` | `VARCHAR(128) NULL` | Receipt identifier emitted after `approved` |
| `failure_reason` | `TEXT NULL` | Set on `failed`/`rolled_back` |
| `expires_at` | `TIMESTAMPTZ NOT NULL` | Lifecycle TTL |
| `idempotency_key` | `VARCHAR(128) UNIQUE NOT NULL` | = `lifecycle_id` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | Updated on each state transition |

Indexes: `organization_id`, `project_id`, `state`, `proposal_id`

---

### `lifecycle_transition_history`

Append-only. One row per state transition. Never updated.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `lifecycle_id` | `VARCHAR(64) NOT NULL` | Soft ref to `proposal_lifecycle_records.lifecycle_id` |
| `organization_id` | `UUID NOT NULL → organizations.id` | Denormalized for tenant-scoped queries |
| `from_state` | `VARCHAR(32) NOT NULL` | |
| `to_state` | `VARCHAR(32) NOT NULL` | |
| `transitioned_at` | `TIMESTAMPTZ NOT NULL` | |
| `reason` | `TEXT NULL` | Operator-provided or system-generated reason |
| `idempotency_key` | `VARCHAR(128) UNIQUE NOT NULL` | `sha256(lifecycle_id:from_state:to_state:transitioned_at)` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Insert time (≥ `transitioned_at`) |

No `updated_at`. Soft ref on `lifecycle_id` (no FK) — transition rows may be
written in the same transaction as the lifecycle row, before it commits.

Indexes: `lifecycle_id`, `organization_id`, `to_state`

---

### `operations_timeline_events`

Append-only audit trail. Never updated.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `entry_id` | `VARCHAR(64) UNIQUE NOT NULL` | `"otl-" + 16-char sha256` |
| `kind` | `VARCHAR(64) NOT NULL` | `OperationsTimelineEventKind` |
| `occurred_at` | `TIMESTAMPTZ NOT NULL` | Business timestamp of the event |
| `organization_id` | `UUID NOT NULL → organizations.id` | Tenant scope |
| `project_id` | `UUID NULL → projects.id` | Optional project scope |
| `lifecycle_id` | `VARCHAR(64) NULL` | Soft ref to `proposal_lifecycle_records.lifecycle_id` |
| `proposal_id` | `VARCHAR(128) NULL` | Phase 9 proposal ID |
| `incident_id` | `VARCHAR(128) NULL` | Incident identifier |
| `severity` | `VARCHAR(16) NULL` | `critical\|high\|medium\|low` |
| `lifecycle_state` | `VARCHAR(32) NULL` | Lifecycle state at time of event |
| `actor_type` | `VARCHAR(16) NOT NULL` | `human\|system` |
| `actor_label` | `VARCHAR(255) NOT NULL` | Operator email or `"Reliai System"` |
| `title` | `VARCHAR(512) NOT NULL` | Human-readable event title |
| `summary` | `TEXT NOT NULL` | Detailed description |
| `policy_gate_result` | `VARCHAR(16) NULL` | `passed\|denied` |
| `evidence_refs` | `JSONB NOT NULL DEFAULT '[]'` | `Array<{label: string, href: string}>` |
| `requires_operator_review` | `BOOLEAN NOT NULL DEFAULT TRUE` | `CHECK (requires_operator_review = TRUE)` |
| `idempotency_key` | `VARCHAR(128) UNIQUE NOT NULL` | = `entry_id` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Insert time |

No `updated_at`. `lifecycle_id` is a soft ref (no FK) — events may be written
before the lifecycle record is committed in race conditions.

Indexes: `organization_id`, `project_id`, `kind`, `occurred_at`, `lifecycle_id`,
`proposal_id`, `incident_id`, `policy_gate_result`

---

### `verification_result_records`

Append-only. One row per verification run. Never updated.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `result_id` | `VARCHAR(64) UNIQUE NOT NULL` | `"vr-" + 16-char sha256` |
| `lifecycle_id` | `VARCHAR(64) NOT NULL` | Soft ref to `proposal_lifecycle_records.lifecycle_id` |
| `proposal_id` | `VARCHAR(128) NOT NULL` | Phase 9 proposal ID |
| `organization_id` | `UUID NOT NULL → organizations.id` | Tenant scope |
| `outcome` | `VARCHAR(32) NOT NULL` | `recovered\|partial_recovery\|no_change\|regressed\|verification_failed` |
| `confidence` | `VARCHAR(16) NOT NULL` | `low\|medium\|high` |
| `rationale` | `TEXT NOT NULL` | Human-readable outcome explanation |
| `error_rate_before_pct` | `NUMERIC(6,3) NOT NULL` | Pre-remediation error rate |
| `error_rate_after_pct` | `NUMERIC(6,3) NOT NULL` | Post-remediation error rate |
| `error_rate_delta_pp` | `NUMERIC(6,3) NOT NULL` | Signed delta in percentage points |
| `latency_p99_before_ms` | `INTEGER NOT NULL` | Pre-remediation p99 latency |
| `latency_p99_after_ms` | `INTEGER NOT NULL` | Post-remediation p99 latency |
| `latency_delta_pct` | `NUMERIC(6,2) NOT NULL` | Signed latency change percentage |
| `gate_checks` | `JSONB NOT NULL DEFAULT '[]'` | `GateCheck[]` — named pass/fail checks |
| `requires_operator_review` | `BOOLEAN NOT NULL DEFAULT TRUE` | `CHECK (requires_operator_review = TRUE)` |
| `idempotency_key` | `VARCHAR(128) UNIQUE NOT NULL` | = `result_id` |
| `computed_at` | `TIMESTAMPTZ NOT NULL` | When the verification was computed |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Insert time |

No `updated_at`. Soft ref on `lifecycle_id` (same rationale as timeline events).

Indexes: `organization_id`, `lifecycle_id`, `outcome`, `computed_at`

---

### `reliability_score_snapshots`

Append-only. One row per score computation. Never updated.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `score_id` | `VARCHAR(64) UNIQUE NOT NULL` | `"score-" + 16-char sha256` |
| `organization_id` | `UUID NOT NULL → organizations.id` | Tenant scope |
| `overall` | `SMALLINT NOT NULL` | Composite score 0–100; `CHECK (overall BETWEEN 0 AND 100)` |
| `overall_grade` | `VARCHAR(1) NOT NULL` | `CHECK (overall_grade IN ('A','B','C','D','F'))` |
| `operational_score` | `SMALLINT NOT NULL` | 0–100 |
| `automation_confidence` | `SMALLINT NOT NULL` | 0–100 |
| `recovery_performance` | `SMALLINT NOT NULL` | 0–100 |
| `policy_safety_score` | `SMALLINT NOT NULL` | 0–100 |
| `dimensions` | `JSONB NOT NULL` | Full `ScoredDimension` objects including factor breakdowns |
| `trend` | `JSONB NOT NULL DEFAULT '[]'` | `ReliabilityTrendPoint[]` 7-day sparkline |
| `requires_operator_review` | `BOOLEAN NOT NULL DEFAULT TRUE` | `CHECK (requires_operator_review = TRUE)` |
| `idempotency_key` | `VARCHAR(128) UNIQUE NOT NULL` | = `score_id` |
| `computed_at` | `TIMESTAMPTZ NOT NULL` | When the score was computed |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Insert time |

No `updated_at`. The four scalar dimension columns allow SQL aggregation without
JSON parsing; `dimensions` JSONB carries the full factor rationale for the UI.

Indexes: `organization_id`, `computed_at`, `overall`

---

## Foreign Key Strategy

Hard FKs are used where the referenced row is guaranteed to exist before or at
the same time as the referencing row:

| Table | Column | Hard FK |
|---|---|---|
| `proposal_lifecycle_records` | `organization_id` | → `organizations.id` |
| `proposal_lifecycle_records` | `project_id` | → `projects.id` |
| `lifecycle_transition_history` | `organization_id` | → `organizations.id` |
| `operations_timeline_events` | `organization_id` | → `organizations.id` |
| `operations_timeline_events` | `project_id` | → `projects.id` |
| `verification_result_records` | `organization_id` | → `organizations.id` |
| `reliability_score_snapshots` | `organization_id` | → `organizations.id` |

Soft refs (no FK, index only) are used where write order is non-deterministic
or where the referenced record is in a different service boundary:

| Table | Column | Reason |
|---|---|---|
| `lifecycle_transition_history` | `lifecycle_id` | Written in same transaction as lifecycle row |
| `operations_timeline_events` | `lifecycle_id` | Events may arrive before lifecycle row commits |
| `verification_result_records` | `lifecycle_id` | Verification may be computed in a separate service call |
| `proposal_lifecycle_records` | `verification_result_id` | Set after verification is recorded |

---

## Migration File

`infra/db/migrations/versions/20260512_0001_phase11_operations_center.py`

- Revision: `20260512_0001`
- Down revision: `20260418_0001` (audit closed-loop integrity)
- Both `upgrade()` and `downgrade()` implemented

---

## Phase 11.3 Adapter Notes

When implementing the FastAPI adapter boundary:

- All inserts use `ON CONFLICT (idempotency_key) DO NOTHING`
- All reads filter by `organization_id` before any other predicate
- `execution_granted = FALSE` is never set to any other value — the CHECK
  constraint will reject it at the DB level if application code tries
- `requires_operator_review = TRUE` is set by `server_default` and enforced
  by CHECK — no application code needs to set it explicitly
- `lifecycle_transition_history` and `operations_timeline_events` rows are
  never passed to `UPDATE` — the adapter must treat them as insert-only
