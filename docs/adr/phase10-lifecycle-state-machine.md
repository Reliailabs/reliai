# ADR — Phase 10 Proposal Lifecycle State Machine

**Status**: Accepted  
**Date**: 2026-05-12  
**Slice**: Phase 10.1  
**Implementation**: `apps/pulse/lib/proposal-lifecycle.ts`

---

## Context

Phase 9 established a validation-only layer for automation proposals: eligibility gating, impact preview, operator confirmation, and evidence receipt emission. All Phase 9 functions are stateless — they validate and return, never persisting anything.

Phase 10 needs to represent the **temporal progression** of a proposal from initial detection through to a verified or failed outcome. The Operations Center UI (10.2) and the Verification Engine (10.3) both need to query proposal state, filter by state, and record transitions over time.

The question was: how to model this progression without breaking Phase 9's validation-only contract, without introducing a database in Phase 10, and without allowing the implementation to imply that Reliai is authorized to perform live production mutations.

---

## Decision

### 1. Forward-only state machine with explicit transition edges

Ten states form a directed acyclic graph with exactly one entry point (`detected`) and four terminal states (`verified`, `failed`, `rolled_back`, `expired`). All transitions are explicit: only the edges listed in `VALID_TRANSITIONS` are permitted. Any attempt to transition via an unlisted edge is rejected with a descriptive error.

**Rejected alternative**: A boolean flag model (`isProposed`, `isApproved`, `isExecuting`). This does not express ordering — a lifecycle could be `isApproved: true` and `isProposed: false`, which is incoherent. A state machine forces each record to occupy exactly one state at a time.

**Rejected alternative**: A free-form status string. Too permissive — allows arbitrary strings that violate the intended flow and break discriminated-union pattern matching on the frontend.

### 2. "executing" is a lifecycle label, not an execution grant

The `approved → executing` transition records that the proposal entered a controlled execution workflow boundary — it does NOT mean Reliai has performed a production action. The `execution_granted: false` field is a TypeScript literal type (not `boolean`), so the compiler rejects `true` at all assignment sites. Every transition function that reaches `executing` emits an explicit runtime warning restating the invariant.

**Rationale**: Phase 8 (`controlled-execution.ts`) established `execution_granted: false` as a non-negotiable invariant. Phase 10 must not appear to soften that boundary. The label approach gives the UI a state to display ("execution in progress") without granting the system actual authority.

### 3. Repository interface for persistence-readiness without premature DB coupling

A `ProposalLifecycleRepository` interface defines three methods: `findById`, `findAll(filter?)`, `save`. The `InMemoryProposalLifecycleRepository` fixture implementation is the only concrete class in Phase 10. The module-level singleton `defaultRepository` is the single substitution point.

**Rationale**: If service functions closed over inline fixture arrays (as in Phase 9's validation functions), replacing them with DB queries in Phase 11 would require rewriting every function signature. The repository interface makes the swap a one-line change in one file.

**Rejected alternative**: A full dependency-injection container. Overkill for Phase 10 — constructor injection with a default parameter achieves the same testability with zero framework overhead.

### 4. save() returns a separate copy from the stored reference

`InMemoryProposalLifecycleRepository.save()` stores one copy and returns a different copy. This prevents callers from mutating the returned lifecycle and corrupting internal repo state (a class of bug that would be silent in tests that don't check internal repo state).

### 5. Function-based service layer, not a class

All service functions (`transitionLifecycle`, `completeProposalExecution`, `verifyProposalOutcome`, `failProposalExecution`) are plain exported functions with an optional `repo` parameter. This mirrors Phase 9's function-based pattern exactly and avoids introducing service classes that would not add value at this scale.

### 6. `state_history` as an append-only log on the entity

Each transition appends a `LifecycleStateHistoryEntry` (from_state, to_state, transitioned_at, reason). This gives the Operations Timeline (Phase 10.2) a complete audit trail without a separate events table. The trade-off is that the entity grows linearly with the number of transitions — acceptable given the 10-state maximum depth.

### 7. 24-hour default TTL enforced at transition time

Lifecycles are not automatically expired by a background job (no workers in Phase 10). Instead, `transitionLifecycle` checks `expires_at` at every call and rejects non-expiry transitions on an expired lifecycle. The caller must explicitly transition to `"expired"` to clean up.

**Rationale**: Consistent with the no-workers constraint. Phase 11 can add a scheduled sweep that calls `transitionLifecycle(id, "expired", "TTL elapsed")` without changing the service logic.

---

## Consequences

### Positive

- The state machine is statically exhaustive: TypeScript's discriminated union on `ProposalLifecycleState` ensures all UI switch statements are checked for completeness at compile time.
- The `execution_granted: false` literal type makes the Phase 8 invariant compiler-enforced, not just documented.
- Repository substitution in Phase 11 requires editing one line in one file.
- The 35-test suite covers all state edges, expiry, terminal rejections, email validation, and repo isolation — no regression risk when adding persistence.

### Negative / Watch

- `InMemoryProposalLifecycleRepository` is a module-level singleton shared across requests in a Next.js server context. In a serverless deployment (Vercel Edge Functions), module state is not guaranteed to persist across cold starts — mutations will be lost. This is acceptable for Phase 10 (demo/fixture data) but **must** be replaced before production use.
- `state_history` growth is unbounded on long-lived proposals. Phase 11 should cap or paginate it when adding DB persistence.
- No cross-lifecycle validation (e.g., "only one executing lifecycle per target_id at a time"). This enforcement is deferred to Phase 11 when a DB query can check existing state.

---

## Phase 11 Extension Points

1. Replace `const defaultRepository = new InMemoryProposalLifecycleRepository()` with `new PostgresProposalLifecycleRepository(db)` — no other changes required.
2. Add a scheduled worker that calls `transitionLifecycle(id, "expired", "TTL elapsed")` for expired non-terminal lifecycles.
3. Add cross-lifecycle uniqueness constraints (one `executing` per `target_id`) in the repository implementation.
4. Extend `LifecycleFilter` with pagination (`limit`, `cursor`) when querying large lifecycle sets.
