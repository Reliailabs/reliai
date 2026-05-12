# Phase 11.1 — Repository Contract Hardening

## Purpose

Extract shared repository interfaces from Phase 10 lib files, make the swap
points explicit and testable, and add contract tests that any Phase 11
DB-backed adapter must pass without modifying service functions or callers.

---

## What Changed

### New: `apps/pulse/lib/repository-contracts.ts`

Shared typed repository base interfaces:

```typescript
// Read-only, append-only — for audit/event streams (timeline, score snapshots)
interface AppendOnlyRepository<TEntity, TFilter>
  findAll(filter?: TFilter): TEntity[]

// Read with individual-record lookup
interface ReadRepository<TEntity, TFilter> extends AppendOnlyRepository
  findById(id: string): TEntity | null

// Full read/write — upsert semantics on save()
interface ReadWriteRepository<TEntity, TFilter> extends ReadRepository
  save(entity: TEntity): TEntity

// Nominal marker for the module-level singleton swap point
type RepositoryAdapter<TRepo> = TRepo
```

### Updated: `lib/proposal-lifecycle.ts`

```typescript
// Before:
interface ProposalLifecycleRepository {
  findById(id: string): ProposalLifecycle | null;
  findAll(filter?: LifecycleFilter): ProposalLifecycle[];
  save(lifecycle: ProposalLifecycle): ProposalLifecycle;
}

// After (same contract, derived from shared base):
interface ProposalLifecycleRepository
  extends ReadWriteRepository<ProposalLifecycle, LifecycleFilter> {}
```

Also fixed: `InMemoryProposalLifecycleRepository.findById` was returning the
internal store reference directly, allowing callers to corrupt repo state by
mutating the result. Now returns a defensive copy consistent with `save`.

Swap point made explicit:
```typescript
const defaultRepository: RepositoryAdapter<ProposalLifecycleRepository> =
  new InMemoryProposalLifecycleRepository();
```

### Updated: `lib/operations-timeline.ts`

```typescript
// Before:
interface OperationsTimelineRepository {
  findAll(filter?: OperationsTimelineFilter): OperationsTimelineEntry[];
}

// After:
interface OperationsTimelineRepository
  extends AppendOnlyRepository<OperationsTimelineEntry, OperationsTimelineFilter> {}
```

`AppendOnlyRepository` is the correct base: timeline entries are written once
and must not be mutated (audit invariant).

Also fixed injection gap: `getOperationsSurfaceData` previously bypassed the
repo parameter pattern, unlike every other service function. Now:
```typescript
export async function getOperationsSurfaceData(
  repo: OperationsTimelineRepository = defaultRepository,
): Promise<OperationsSurfaceData>
```

### New: `apps/pulse/tests/repository-contracts.test.ts`

Contract test harness (50 tests total across both files):

- `runAppendOnlyContract` — tests via a `StubAppendOnlyRepository` (required
  because `InMemoryOperationsTimelineRepository` lives behind `server-only`)
- `runReadWriteContract` — run against `InMemoryProposalLifecycleRepository`
  with an empty seed for full isolation

Coverage per contract:
- `findAll` returns an array
- `findAll` returns a consistent count across calls
- Mutating the returned array does not affect internal state
- `findById` returns null for unknown ids
- `findById` returns a copy, not the internal reference
- `save` then `findById` round-trip
- `save` returns a copy, not the input reference
- `save` is an upsert (no duplicates)
- `findAll` includes saved entities

### Fixed: `tests/proposal-lifecycle.test.ts`

`makeLifecycle` hardcoded `expires_at: "2026-05-12T08:00:00.000Z"` — that
date has passed, causing the expiry guard to reject all `transitionLifecycle`
tests silently. Updated to `"2099-12-31T23:59:59.000Z"` to prevent date drift.

---

## Adapter Hierarchy (Phase 10 + planned Phase 11)

| Repository | Base interface | Phase 10 adapter |
|---|---|---|
| `ProposalLifecycleRepository` | `ReadWriteRepository` | `InMemoryProposalLifecycleRepository` |
| `OperationsTimelineRepository` | `AppendOnlyRepository` | `InMemoryOperationsTimelineRepository` |
| `VerificationResultRepository` | `ReadWriteRepository` | `InMemoryVerificationResultRepository` (Phase 10.3) |
| `ReliabilityScoreRepository` | `AppendOnlyRepository` | fixture function `getReliabilityScore()` (Phase 10.4) |

---

## Phase 11 Adapter Registration

When a DB-backed adapter is ready, the swap requires two steps:

1. Implement the existing interface (no interface changes needed):
   ```typescript
   class PostgresProposalLifecycleRepository
     implements ProposalLifecycleRepository { ... }
   ```

2. Change the `defaultRepository` assignment in the lib file:
   ```typescript
   const defaultRepository: RepositoryAdapter<ProposalLifecycleRepository> =
     new PostgresProposalLifecycleRepository(dbClient);
   ```

3. Register in the contract test file to confirm the adapter passes all
   contract checks before shipping.

---

## Invariants

- No behavior change to any service function or public API
- All in-memory adapters preserved exactly (one correctness fix to `findById`)
- `execution_granted: false` and `requires_operator_review: true` literals
  are on the entity types, not the repository interface — they survive any adapter swap
