# Phase 11.4 — Read-path Integration

**Status:** Complete  
**Date:** 2026-05-12  
**Branch:** feat/pulse-phase11-persistence-adapter-boundary  

---

## Summary

Phase 11.4 wires the read path from the Pulse frontend to the FastAPI backend for the Operations Center, while preserving full fixture-mode fallback. No write paths are activated.

---

## FastAPI endpoints added

### `GET /api/v1/operations/timeline`

Returns a paginated list of `OperationsTimelineEvent` rows scoped to the operator's active organization.

**Query parameters** (all optional):

| Parameter | Type | Description |
|---|---|---|
| `kind` | `str` | Filter by event kind (e.g. `incident_detected`) |
| `severity` | `str` | `critical`, `high`, `medium`, `low` |
| `actor_type` | `str` | `human` or `system` |
| `lifecycle_state` | `str` | Lifecycle state at event time |
| `incident_id` | `str` | Filter to a specific incident |
| `proposal_id` | `str` | Filter to a specific proposal |
| `limit` | `int` | Max results (default 50) |

**Response:** `TimelineListResponse` — `{ items: TimelineEventRead[], total: int }`

### `GET /api/v1/operations/lifecycles`

Returns `ProposalLifecycleRecord` rows with their full `LifecycleTransitionHistory` batched in.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `state` | `str` | Filter by lifecycle state |
| `proposal_id` | `str` | Filter to a specific proposal |
| `limit` | `int` | Max results (default 50) |

**Response:** `LifecycleListResponse` — `{ items: LifecycleRead[], total: int }`

---

## Service layer (`app/services/operations.py`)

### `list_timeline_events(db, operator, query) → (list[TimelineEventRead], int)`

1. Guards on `operator.active_organization_id is None` → returns `([], 0)`
2. Builds `SELECT … WHERE organization_id = :org_id` with optional AND predicates
3. Issues a `func.count()` subquery for `total` before applying `limit`
4. Returns `(items, total)`

### `list_lifecycles(db, operator, query) → (list[LifecycleRead], int)`

1. Same org guard
2. Fetches lifecycle records + count
3. Batch-loads `LifecycleTransitionHistory` with `IN (lifecycle_ids)` — no N+1
4. `_build_lifecycle_read()` constructs `LifecycleRead` manually (not via `model_validate`) to:
   - Hardcode `execution_granted=False` at the read layer (defence-in-depth)
   - Hardcode `requires_operator_review=True`
   - Attach `state_history` sorted ascending by `transitioned_at`

---

## Schemas (`app/schemas/operations.py`)

```
TimelineListQuery      — query params for /timeline
LifecycleListQuery     — query params for /lifecycles
TimelineEventRead      — APIModel (from_attributes=True); direct ORM → Pydantic
LifecycleRead          — BaseModel (manual construction; state_history from joined table)
LifecycleStateHistoryRead — from_state, to_state, transitioned_at, reason
TimelineListResponse   — { items, total }
LifecycleListResponse  — { items, total }
```

`LifecycleRead` is `BaseModel` rather than `APIModel` because `state_history` cannot be
populated by `model_validate(orm_obj)` — it comes from a separate `lifecycle_transition_history`
table loaded in a second query.

---

## Pulse adapter (`apps/pulse/lib/operations-adapter.ts`)

`BackendOperationsTimelineRepository` injects a `TokenProvider` (default: `getApiAccessToken`),
forwarded to `backendGet<BackendTimelineListResponse>` as a Bearer token provider.

This decoupling allows test injection of `async () => "test-token"` without touching `next/headers`.

**Live mode path:**
```
getOperationsSurfaceData(repo: BackendOperationsTimelineRepository)
  → isAsyncTimelineRepo(repo) === true
  → repo.fetchAll(filter?)
  → backendGet("/api/v1/operations/timeline", tokenProvider)
  → fetch(NEXT_PUBLIC_API_URL + path, { headers: { Authorization: "Bearer <token>" } })
  → maps BackendTimelineListResponse to OperationsTimelineEntry[]
```

**Failure fallback:**
- Any non-OK HTTP response or network error → `repo._errors.push(...)` → `drainErrors()` returns them
- `getOperationsSurfaceData` propagates `drainErrors()` into `sourceErrors[]`
- `dataMode` remains `"live"` (mode reflects repo type, not health)

---

## Fixture ↔ backend parity

Both modes produce `OperationsSurfaceData`:

```typescript
interface OperationsSurfaceData {
  entries: OperationsTimelineEntry[];
  dataMode: "demo" | "live";
  sourceErrors: string[];
}
```

`requires_operator_review` is `true` in all fixture entries (verified by test) and hardcoded
in `_build_lifecycle_read()` at the API layer (defence-in-depth, verified by test).

---

## Test coverage

**`apps/api/tests/test_operations.py`** — 19 tests:
- Auth guard (401 without operator session)
- Empty org returns 0 items
- Basic timeline + lifecycle reads
- Tenant isolation (org A cannot see org B's data)
- Filter params (kind, severity, actor_type, incident_id, proposal_id)
- Limit param
- State history ordering (ascending `transitioned_at`)
- State history empty list
- `execution_granted` and `requires_operator_review` hardcoded invariants

**`apps/pulse/tests/operations-adapter.test.ts`** — 12 tests:
- Fixture mode: deterministic, `dataMode=demo`, `requires_operator_review=true`
- Backend mode success: response mapping, `dataMode=live`, filter params → query string
- Backend failures: 404 / 503 / network error → empty entries + `sourceErrors`
- `drainErrors()` idempotency
- `findAll()` sync no-op

---

## Env var

```
RELIAI_OPERATIONS_DATA_MODE=fixture   # default — in-memory fixture data
RELIAI_OPERATIONS_DATA_MODE=live      # FastAPI backend via Bearer token
```

See `docs/phase11-3-fastapi-adapter-boundary.md` for the full dual-mode architecture.
