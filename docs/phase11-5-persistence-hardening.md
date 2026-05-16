# Phase 11.5 — Persistence Hardening

**Status:** Complete  
**Date:** 2026-05-12  
**Branch:** feat/pulse-embed-deployment-intelligence-snippets  

---

## Summary

Phase 11.5 hardens the append-only storage invariants, idempotency guarantees, tenant isolation, and write-path lockout for the Operations Center introduced in Phase 11.2–11.4.  
No new write paths are activated. All tests remain read-only or constraint-verification only.

---

## Tables in scope

| Table | Mutable? | `updated_at`? |
|---|---|---|
| `operations_timeline_events` | No — append-only | No |
| `lifecycle_transition_history` | No — append-only | No |
| `proposal_lifecycle_records` | Yes — state machine | Yes |

---

## Idempotency guarantees

Each table has a `UNIQUE` constraint on `idempotency_key`:

```sql
-- operations_timeline_events
UNIQUE (idempotency_key)   -- name: uq_operations_timeline_events_idempotency_key
UNIQUE (entry_id)          -- name: uq_operations_timeline_events_entry_id

-- proposal_lifecycle_records
UNIQUE (idempotency_key)   -- name: uq_proposal_lifecycle_records_idempotency_key
UNIQUE (lifecycle_id)      -- name: uq_proposal_lifecycle_records_lifecycle_id

-- lifecycle_transition_history
UNIQUE (idempotency_key)   -- name: uq_lifecycle_transition_history_idempotency_key
```

Re-submitting an event with the same `idempotency_key` raises `IntegrityError` at the DB layer, preventing duplicate audit entries from retried requests.  
`lifecycle_transition_history` allows multiple transitions for the same lifecycle (different `from_state`/`to_state` pairs) as long as each has a unique `idempotency_key`.

---

## Append-only invariants

`operations_timeline_events` and `lifecycle_transition_history` encode their append-only nature structurally:

- **No `updated_at` column** — absence of `updated_at` is the invariant signal; any migration that adds `updated_at` to these tables violates the contract.
- **No update/upsert service functions** — `app/services/operations.py` exports only `list_timeline_events` and `list_lifecycles`. No `save`, `update`, or `upsert` functions exist.
- **No write endpoints** — read routes under `/operations/` include timeline/lifecycle list and by-id endpoints only (`GET /api/v1/operations/timeline`, `GET /api/v1/operations/timeline/{entry_id}`, `GET /api/v1/operations/lifecycles`, `GET /api/v1/operations/lifecycles/{lifecycle_id}`). No `POST`, `PUT`, `PATCH`, or `DELETE` methods are registered.

These are verified programmatically in `tests/test_operations_hardening.py`:

```
test_timeline_event_has_no_updated_at_column
test_lifecycle_transition_history_has_no_updated_at_column
test_lifecycle_record_has_updated_at_column           ← positive: PLR IS mutable
test_timeline_event_has_no_service_update_path
test_backend_lifecycle_save_not_implemented
test_api_has_no_post_operations_endpoints
```

---

## Governance CHECK constraints

Two governance invariants are enforced at the database layer, so no code path (including direct SQL) can violate them:

### `proposal_lifecycle_records`

```sql
CHECK (execution_granted = FALSE)
CHECK (requires_operator_review = TRUE)
```

SQLAlchemy model names (resolved via `ck_%(table_name)s_%(constraint_name)s` naming convention):
- `ck_proposal_lifecycle_records_execution_granted_false`
- `ck_proposal_lifecycle_records_requires_operator_review_true`

### `operations_timeline_events`

```sql
CHECK (requires_operator_review = TRUE)
```

Resolved name: `ck_operations_timeline_events_requires_operator_review_true`

Both constraints mirror Phase 11.2 Alembic migration definitions.  
Application code additionally hardcodes `execution_granted=False` and `requires_operator_review=True` in `_build_lifecycle_read()` regardless of DB value — defence-in-depth at the read path.

---

## Tenant isolation

All queries in `app/services/operations.py` filter by `operator.active_organization_id` as the first predicate:

```python
org_id = operator.active_organization_id
if org_id is None:
    return [], 0
stmt = select(OperationsTimelineEvent).where(
    OperationsTimelineEvent.organization_id == org_id,
    ...
)
```

Cross-organization data leakage is verified in `test_timeline_events_org_isolation_soft_lifecycle_ref`: two orgs that share the same `lifecycle_id` (soft ref, no FK) each see only their own events.

**Current gap (documented):** `lifecycle_transition_history` is not independently filtered by `org_id`; it is fetched by `lifecycle_id` values that already belong to the requesting org's lifecycle records. This is safe today because `lifecycle_id` values are opaque UUIDs generated per lifecycle. The gap is tracked in `test_lifecycles_state_history_tenant_scoped_independently` and should be addressed when a history table `organization_id` column is added.

---

## Migration / model column consistency

`test_timeline_event_model_columns_match_migration`, `test_lifecycle_record_model_columns_match_migration`, and `test_lifecycle_transition_history_model_columns_match_migration` verify that SQLAlchemy model columns match the expected column sets from the Phase 11.2 migration exactly.  
Any column added to the migration but absent from the model (or vice versa) will fail these tests.

---

## Frontend fallback observability

`apps/pulse/components/operations/operations-timeline-view.tsx` was updated to:

- **Before:** `sourceErrors` caused a full-page replacement error view — all data was hidden.
- **After:** `sourceErrors` renders an inline warning banner ("Live data unavailable. Showing demo fixture data.") while still displaying whatever entries are available.
- Added a **"Live data" pulse badge** when `dataMode === "live"` (green animated dot, alongside the existing "Demo data" label).

This means a transient backend outage degrades gracefully — operators see stale fixture data with a clear warning rather than a blank screen.

---

## Write-path status

| Path | Status |
|---|---|
| `POST /api/v1/operations/*` | ❌ Not implemented |
| `PUT/PATCH /api/v1/operations/*` | ❌ Not implemented |
| `services/operations.py` save/upsert | ❌ Not implemented |
| `BackendOperationsTimelineRepository.save()` | ❌ Not implemented |
| `InMemoryOperationsTimelineRepository.save()` | ❌ Not implemented |

Write paths will be activated in a future phase once the full ingest pipeline is defined.

---

## Test files

| File | Tests | Language |
|---|---|---|
| `apps/api/tests/test_operations_hardening.py` | 24 | Python |
| `apps/pulse/tests/operations-hardening.test.ts` | 14 | TypeScript |

All tests pass as of 2026-05-12.

### Running the Python tests

```bash
.venv/bin/python -m pytest apps/api/tests/test_operations_hardening.py -v
```

### Running the TypeScript tests

```bash
cd apps/pulse
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test tests/operations-hardening.test.ts
```
