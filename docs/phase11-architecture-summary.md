# Phase 11 Architecture Summary — Operations Center

**Phases:** 11.1 – 11.5  
**Completed:** 2026-05-12  
**Branch merged:** feat/pulse-phase11-persistence-adapter-boundary  

---

## What was built

Phase 11 delivers the foundational layer for the **Operations Center** — a read-only, governance-hardened view of AI proposal lifecycles and timeline events for a human operator.

The system is explicitly **read-only and write-disabled** at every layer:  
no autonomous execution, no write endpoints, no upsert functions.  
Writes are staged for a future phase once the full ingest pipeline is defined.

---

## Architecture layers

```
┌─────────────────────────────────────────────────────┐
│  Pulse UI  (apps/pulse)                             │
│  OperationsTimelineView — React, "use client"       │
│  · live/demo badge  · inline sourceErrors banner    │
├─────────────────────────────────────────────────────┤
│  operations-timeline.ts                             │
│  getOperationsSurfaceData(repo)                     │
│  → isAsyncTimelineRepo() duck-type guard            │
│  → dataMode: "demo" | "live"                        │
├────────────────────┬────────────────────────────────┤
│ InMemoryOperations │  BackendOperationsTimeline      │
│ TimelineRepository │  Repository                     │
│ (fixture, sync)    │  (live, async fetchAll)         │
│                    │  TokenProvider injection        │
│                    │  drainErrors() buffer           │
├────────────────────┴────────────────────────────────┤
│  operations-adapter.ts                              │
│  backendGet(path, tokenProvider)                    │
│  RELIAI_OPERATIONS_DATA_MODE env var routing        │
├─────────────────────────────────────────────────────┤
│  FastAPI  (apps/api)                                │
│  GET /api/v1/operations/timeline                    │
│  GET /api/v1/operations/lifecycles                  │
│  → require_operator (tenant scope)                  │
├─────────────────────────────────────────────────────┤
│  app/services/operations.py                         │
│  list_timeline_events()  list_lifecycles()          │
│  · org_id guard first  · batch history load         │
│  · execution_granted=False hardcoded (read layer)   │
├─────────────────────────────────────────────────────┤
│  PostgreSQL / SQLite                                │
│  operations_timeline_events   (append-only)        │
│  lifecycle_transition_history (append-only)        │
│  proposal_lifecycle_records   (mutable, state FSM) │
└─────────────────────────────────────────────────────┘
```

---

## Phase-by-phase summary

### Phase 11.1 — Repository contract hardening
**Doc:** `docs/phase11-1-repository-contracts.md`

- Defined `OperationsTimelineRepository` interface (sync `findAll`)
- Added `AsyncTimelineRepo` + `isAsyncTimelineRepo()` duck-type guard for live repos
- Fixture `InMemoryOperationsTimelineRepository` — deterministic seed, `dataMode="demo"`
- All fixture entries carry `requires_operator_review: true` (invariant)

### Phase 11.2 — Persistence schema design
**Doc:** `docs/phase11-2-persistence-schema-design.md`

Three new tables, one Alembic migration:

| Table | Type | Key invariants |
|---|---|---|
| `operations_timeline_events` | Append-only | No `updated_at`; `UNIQUE(entry_id, idempotency_key)`; `CHECK(requires_operator_review=TRUE)` |
| `lifecycle_transition_history` | Append-only | No `updated_at`; `UNIQUE(idempotency_key)`; `lifecycle_id` is a soft ref (no FK) |
| `proposal_lifecycle_records` | Mutable FSM | Has `updated_at`; `UNIQUE(lifecycle_id, idempotency_key)`; `CHECK(execution_granted=FALSE)`; `CHECK(requires_operator_review=TRUE)` |

### Phase 11.3 — FastAPI adapter boundary
**Doc:** `docs/phase11-3-fastapi-adapter-boundary.md`

- `BackendOperationsTimelineRepository` with `TokenProvider` injection
- `backendGet()` — typed fetch wrapper with 404 special-casing and `drainErrors()` error buffer
- `RELIAI_OPERATIONS_DATA_MODE` env var routes fixture vs live at startup
- `getOperationsSurfaceData()` returns `{ entries, dataMode, sourceErrors }`

### Phase 11.4 — Read-path integration
**Doc:** `docs/phase11-4-read-path-integration.md`

- `GET /api/v1/operations/timeline` — org-scoped, filtered, paginated
- `GET /api/v1/operations/lifecycles` — org-scoped, batch history load
- `app/services/operations.py` — `list_timeline_events`, `list_lifecycles`, `_build_lifecycle_read`
- `app/schemas/operations.py` — full Pydantic schema set
- `apps/pulse/tests/operations-adapter.test.ts` — 12 tests (fixture, backend, failure)
- `apps/api/tests/test_operations.py` — 19 tests (auth, isolation, filters, invariants)

### Phase 11.5 — Persistence hardening
**Doc:** `docs/phase11-5-persistence-hardening.md`

- Fixed SQLAlchemy CHECK constraint naming (removed double-prefix)
- 24 Python hardening tests: idempotency, CHECK enforcement, append-only shape, tenant isolation, write-path absent, migration/model parity
- 14 TypeScript hardening tests: write-path absent, interface shape, governance invariants, fallback observability, drain idempotency
- `OperationsTimelineView` upgraded to inline error banner + live data badge
- `RELIAI_OPERATIONS_DATA_MODE` added to `.env.example`

---

## Governance invariants (enforced at every layer)

| Invariant | DB CHECK | Service hardcode | Type literal | Test |
|---|---|---|---|---|
| `execution_granted = FALSE` | ✅ | ✅ | ✅ `false` | ✅ |
| `requires_operator_review = TRUE` | ✅ | ✅ | ✅ `true` | ✅ |
| No write endpoints under `/operations/` | — | — | — | ✅ |
| No `updated_at` on append-only tables | — | — | — | ✅ |
| No `save`/`upsert` in service layer | — | — | — | ✅ |
| No `save`/`upsert` in frontend repos | — | — | — | ✅ |

---

## Test inventory

| File | Tests | What it covers |
|---|---|---|
| `apps/api/tests/test_operations.py` | 19 | API routes, tenant isolation, filters, invariants |
| `apps/api/tests/test_operations_hardening.py` | 24 | DB constraints, append-only shape, write-path absent, column parity |
| `apps/pulse/tests/operations-adapter.test.ts` | 12 | Fixture mode, backend mode, failure fallback |
| `apps/pulse/tests/operations-hardening.test.ts` | 14 | Write-path absent, governance fields, sourceErrors, drainErrors |

**Total: 69 tests — all passing**

---

## Key files

```
apps/api/
  app/models/
    operations_timeline_event.py
    proposal_lifecycle_record.py
    lifecycle_transition_history.py (Phase 11.2)
  app/schemas/operations.py
  app/services/operations.py
  app/db/base.py                        (model imports)
  tests/test_operations.py
  tests/test_operations_hardening.py

apps/pulse/
  lib/operations-adapter.ts
  lib/operations-timeline.ts            (repository interface + InMemory impl)
  components/operations/
    operations-timeline-view.tsx
  tests/
    __mocks__/server-only.ts
    operations-adapter.test.ts
    operations-hardening.test.ts
  tsconfig.test.json                    (server-only path stub)

docs/
  phase11-1-repository-contracts.md
  phase11-2-persistence-schema-design.md
  phase11-3-fastapi-adapter-boundary.md
  phase11-4-read-path-integration.md
  phase11-5-persistence-hardening.md
  phase11-architecture-summary.md       (this file)

.env.example                            (RELIAI_OPERATIONS_DATA_MODE documented)
```

---

## What's not built yet (Phase 12 scope)

- Write path: event ingest, lifecycle creation, state transitions
- `POST /api/v1/operations/timeline/events`
- `POST /api/v1/operations/lifecycles`
- `PATCH /api/v1/operations/lifecycles/{id}/transition`
- Real-time event streaming / SSE for the timeline
- `/operations/incidents/[id]` incident detail surface
- Verification + reliability scoring integration into incident response UX
- Unified compare/investigate/command semantics across incidents + regressions

---

## Running all Phase 11 tests

```bash
# Python (from repo root)
.venv/bin/python -m pytest apps/api/tests/test_operations.py \
                           apps/api/tests/test_operations_hardening.py -v

# TypeScript (from apps/pulse)
cd apps/pulse
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test \
  tests/operations-adapter.test.ts \
  tests/operations-hardening.test.ts
```
