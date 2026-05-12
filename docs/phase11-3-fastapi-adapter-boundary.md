# Phase 11.3 — FastAPI Adapter Boundary

## Purpose

Define a typed adapter layer between the Next.js server and the FastAPI backend
for Operations Center data. This phase introduces:

1. `operations-adapter.ts` — the adapter boundary module
2. Factory functions wired into `operations-timeline.ts` via a feature flag
3. Graceful fallback stubs so the system stays operational until Phase 11.4
   implements the real FastAPI routes

---

## Feature Flag

```
RELIAI_OPERATIONS_DATA_MODE=fixture   (default) → in-memory Phase 10 fixture data
RELIAI_OPERATIONS_DATA_MODE=live               → FastAPI backend via Bearer token
```

The flag is read once at module load by `getOperationsAdapterMode()` and used by
the `createTimelineRepo` / `createLifecycleRepo` factory functions.

---

## Module: `apps/pulse/lib/operations-adapter.ts`

### Exports

| Export | Kind | Purpose |
|---|---|---|
| `OperationsAdapterMode` | type | `"fixture" \| "live"` |
| `getOperationsAdapterMode()` | function | Reads env var, defaults to `"fixture"` |
| `BackendOperationsTimelineRepository` | class | Calls `GET /api/v1/operations/timeline` |
| `BackendProposalLifecycleRepository` | class | Calls `/api/v1/operations/lifecycles` endpoints |
| `createTimelineRepo(mode, fixtureRepo)` | function | Factory — returns appropriate impl |
| `createLifecycleRepo(mode, fixtureRepo)` | function | Factory — returns appropriate impl |

### Why factory functions accept fixtureRepo as a parameter

`operations-timeline.ts` imports from `operations-adapter.ts`. If the adapter
also imported `InMemoryOperationsTimelineRepository` from `operations-timeline.ts`,
that would create a circular dependency. The factory accepts the fixture instance
as a parameter so the caller owns construction.

---

## Backend API Contracts (FastAPI — Phase 11.4 target)

### `GET /api/v1/operations/timeline`

Query parameters (all optional):

| Param | Type | Notes |
|---|---|---|
| `kind` | `string` | `OperationsTimelineEventKind` value |
| `severity` | `string` | `critical\|high\|medium\|low` |
| `actor_type` | `string` | `human\|system` |
| `lifecycle_state` | `string` | `ProposalLifecycleState` value |
| `incident_id` | `string` | Exact match |
| `proposal_id` | `string` | Exact match |

Response shape (`BackendTimelineListResponse`):

```typescript
{
  items: Array<{
    entry_id: string;                           // "otl-" + 16-char sha256
    kind: string;                               // OperationsTimelineEventKind
    occurred_at: string;                        // ISO 8601 UTC
    organization_id: string;
    project_id: string | null;
    lifecycle_id: string | null;
    proposal_id: string | null;
    incident_id: string | null;
    severity: string | null;
    lifecycle_state: string | null;
    actor_type: "human" | "system";
    actor_label: string;
    title: string;
    summary: string;
    policy_gate_result: "passed" | "denied" | null;
    evidence_refs: Array<{ label: string; href: string }>;
    requires_operator_review: true;             // always true (DB CHECK constraint)
  }>;
  total: number;
}
```

### `GET /api/v1/operations/lifecycles`

Query parameters (all optional):

| Param | Type | Notes |
|---|---|---|
| `state` | `string` | `ProposalLifecycleState` value |
| `organization_id` | `string` | UUID |
| `proposal_id` | `string` | Phase 9 proposal ID |

### `GET /api/v1/operations/lifecycles/{lifecycle_id}`

Path parameter: `lifecycle_id` (URL-encoded).

Response shape (`BackendLifecycleRead`) mirrors `proposal_lifecycle_records` columns
plus an inline `state_history` array (joined from `lifecycle_transition_history`).

```typescript
{
  lifecycle_id: string;
  proposal_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  organization_id: string;
  project_id: string | null;
  state: string;
  execution_granted: false;                     // always false (DB CHECK constraint)
  requires_operator_review: true;               // always true (DB CHECK constraint)
  operator_email: string | null;
  verification_result_id: string | null;
  audit_receipt_id: string | null;
  failure_reason: string | null;
  expires_at: string;                           // ISO 8601 UTC
  created_at: string;
  updated_at: string;
  state_history: Array<{
    from_state: string;
    to_state: string;
    transitioned_at: string;
    reason: string | null;
  }>;
}
```

---

## Shared Fetch Helper: `backendGet<T>(path)`

All backend calls go through `backendGet`. It:

1. Calls `getApiAccessToken()` — returns `null` if no session, producing an error entry
2. Issues `fetch(API_URL + path)` with `Authorization: Bearer <token>`, `cache: "no-store"`
3. On HTTP 404 → returns `{ ok: false, error: "operations endpoint not yet implemented: ... — set RELIAI_OPERATIONS_DATA_MODE=fixture" }`
4. On other non-OK status → returns `{ ok: false, error: "backend request failed: <status> <path>" }`
5. On network/parse error → returns `{ ok: false, error: "backend fetch error: <message>" }`
6. Never throws — always returns a discriminated union `{ ok: true; data: T } | { ok: false; error: string }`

---

## Sync/Async Interface Split

`OperationsTimelineRepository.findAll()` is synchronous (Phase 10 contract).
`BackendOperationsTimelineRepository` needs an async call to reach FastAPI.

Resolution:

| Method | Behavior |
|---|---|
| `findAll()` | Sync no-op stub — returns `[]`; satisfies the interface |
| `fetchAll()` | Async — the real FastAPI call; used by `getOperationsSurfaceData` |
| `drainErrors()` | Returns and clears accumulated fetch errors |

`getOperationsSurfaceData` uses a structural type guard (`isAsyncTimelineRepo`) to
detect live-mode repos and call `fetchAll()` instead of `findAll()`:

```typescript
if (isAsyncTimelineRepo(repo)) {
  const entries = await repo.fetchAll();
  const sourceErrors = repo.drainErrors();
  return { entries, sourceErrors, dataMode: "live" };
}
const entries = repo.findAll();
return { entries, sourceErrors: [], dataMode: "demo" };
```

The type guard avoids importing `BackendOperationsTimelineRepository` directly
into `operations-timeline.ts`, which would create a circular dependency.

---

## Phase 11.4 Extension Points

Phase 11.4 wires the actual FastAPI route handlers. From the adapter's perspective,
no changes are needed — the `backendGet` helper will receive real responses instead
of 404s.

Two gaps remain after 11.3 that Phase 11.4 must close:

1. **`BackendProposalLifecycleRepository.save()`** — currently throws
   `"not yet implemented — Phase 11.4"`. Needs a `POST /api/v1/operations/lifecycles`
   endpoint and implementation.

2. **`proposal-lifecycle.ts` defaultRepository** — still uses `InMemoryProposalLifecycleRepository`
   unconditionally. Phase 11.4 should wire `createLifecycleRepo` the same way
   `operations-timeline.ts` was updated in Phase 11.3.

---

## Invariants Preserved

- `execution_granted` is always hardcoded `false` in `toLifecycle()` — never
  read from the backend response field (which is also always `false` per DB CHECK).
- `requires_operator_review` is always hardcoded `true` in `toTimelineEntry()` and
  `toLifecycle()` — same rationale.
- All backend calls filter by `organization_id` at the FastAPI layer (Phase 11.4
  responsibility); the adapter trusts the response shape but not the auth boundary.
- The adapter module carries `import "server-only"` — it cannot be bundled into
  client components.
