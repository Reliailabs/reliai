# ADR: Phase 10.5 — Orchestration Boundary Contract

**Status**: Accepted  
**Date**: 2026-05-11  
**Deciders**: Robert (product), Claude (implementation)

---

## Context

Phase 10 delivered four implementation slices (10.1–10.4) across independent library files. Each slice solves a specific problem:

| Slice | File | Concern |
|---|---|---|
| 10.1 | `lib/proposal-lifecycle.ts` | State machine for proposal progression |
| 10.2 | `lib/operations-timeline.ts` | Unified audit timeline |
| 10.3 | `lib/verification-engine.ts` | Post-execution outcome classification |
| 10.4 | `lib/reliability-scoring.ts` | Explainable multi-dimension score |

These files work together but have no shared interface contract. The pipeline — from incident detection through policy gate, proposal generation, operator confirmation, execution boundary, and verification — exists implicitly. Each slice calls its predecessor by direct import.

Phase 11 will:
- Add real DB persistence (replacing in-memory repositories)
- Add async workers (replacing synchronous call chains)
- Add a real execution layer (replacing the fixture-backed executing state)
- Possibly add a real-time event stream (replacing the full-page-reload surface)

Without an explicit boundary contract, Phase 11 changes to one slice risk unexpected breakage across others. There is also no machine-readable description of what the full pipeline looks like.

---

## Decision

Define `lib/phase10-orchestration-boundary.ts` as a **specification-only** TypeScript file that:

1. Names all 7 pipeline stages: Detector → Policy Engine → Proposal Engine → Execution Planner → Staging Executor → Verification Engine → Audit Ledger
2. Defines typed `StageInput<T>` / `StageOutput<TOk, TErr>` envelopes that carry governance invariants on every message
3. Defines a `PipelineStageContract<TPayload, TOk, TErr>` interface with an async `execute()` signature for Phase 11 to implement
4. Exports `Phase10OrchestrationBoundary` — the full pipeline type that Phase 11 satisfies with `... satisfies Phase10OrchestrationBoundary`
5. Exports `PHASE10_ORCHESTRATION_INVARIANTS`, `PIPELINE_STAGE_ORDER`, and `PHASE10_STAGE_IMPLEMENTATIONS` as auditable runtime constants

The file contains **no implementations**. No function bodies. No Zod. No crypto. No imports from other `lib/` files.

---

## Rationale

### Why contract-only in Phase 10

Phase 10 is a validation phase. The goal is to prove the pipeline model is correct before committing to its implementation. Defining the contract now:

- Forces precise naming of every stage and its input/output shape before Phase 11 implementation begins
- Documents the governance invariants (`execution_granted: false`, `requires_operator_review: true`) at the boundary level, not just the type level of individual records
- Creates a checklist for Phase 11: each stage has a named file path in `PHASE10_STAGE_IMPLEMENTATIONS`

Adding live implementations now (workers, queues, real execution) would contradict the Phase 10 constraint of "no autonomous production mutations" and would require DB schema changes that belong to Phase 11.

### Why 7 stages (not 5, not 10)

The stage count reflects natural seams between actors and concerns:

| Stage | Actor | Concern |
|---|---|---|
| Detector | system | Signal ingestion |
| Policy Engine | system | Safety gate |
| Proposal Engine | system | Action generation |
| Execution Planner | system | Plan construction |
| Staging Executor | human + system | Operator-confirmed boundary entry |
| Verification Engine | system | Outcome classification |
| Audit Ledger | system | Immutable record |

Staging Executor is the only stage with a human actor. It is the gate that prevents any stage from having `execution_granted: true` — the human confirmation is explicit, not inferred.

**Rejected: 5 stages (merging planner+executor and verification+ledger)**: Loses the distinction between "building a plan" (Planner) and "recording operator confirmation" (Executor). The operator confirmation boundary is too important to merge with plan construction.

**Rejected: 10 stages (splitting policy engine into multiple gates)**: Premature. The Phase 9 policy engine already handles multiple checks internally. Phase 11 can refine the policy stage without adding new boundary stages.

### Why governance invariants on every envelope, not just select types

The existing codebase uses `requires_operator_review: true` and `execution_granted: false` as per-record literal types. The boundary promotes these to **envelope-level** invariants. Every message between every stage carries both fields.

This makes it structurally impossible for Phase 11 to:
- Add a stage that removes `requires_operator_review`
- Pass a message through the pipeline with `execution_granted: true`

TypeScript will reject such implementations at compile time, not just at runtime.

### Why `execute()` returns `Promise<StageOutput<...>>`

Phase 10 implementations are synchronous (all in-memory). Phase 11 implementations will be async (DB queries, API calls). Making `execute()` async in the contract now means Phase 11 implementations don't need to wrap synchronous code in `Promise.resolve()` — they're already async by contract.

**Rejected: synchronous execute()**: Would require Phase 11 to change the interface signature, breaking the "satisfy without changing" contract guarantee.

### Why the boundary is self-contained (no lib/ imports)

The boundary file imports nothing. It defines its own `PipelineActionType`, `PipelineTargetType`, `Severity`, `BlastRadiusScope`, etc. — even though equivalent types exist in `controlled-execution.ts` and `assisted-automation.ts`.

This is intentional: the boundary is the spec, not an alias of an existing implementation. If `controlled-execution.ts` changes its action type list, the boundary remains stable. Phase 11 can reconcile the two when implementing.

**Rejected: importing from controlled-execution.ts**: Would couple the boundary to Phase 10's implementation, defeating the purpose of a stable contract.

### Why `PHASE10_STAGE_IMPLEMENTATIONS` is a constant, not a doc comment

A `Record<StageName, string | null>` constant is:
- Type-checked: if a new stage is added to `Phase10OrchestrationBoundary["stages"]`, TypeScript will require a new entry
- Grep-able: `grep PHASE10_STAGE_IMPLEMENTATIONS` finds all stage→file mappings
- Auditable at runtime: Phase 11 can print or log this at startup

A doc comment would silently go stale.

---

## Consequences

**Good**:
- Phase 11 has an explicit checklist: implement 7 `PipelineStageContract` classes
- Governance invariants are enforced at compile time across the entire pipeline
- `PIPELINE_STAGE_ORDER` and `PHASE10_ORCHESTRATION_INVARIANTS` are importable by the Operations Center, docs generators, and test suites
- The file is zero-runtime-cost — it is entirely erased at compile time except for the 3 exported constants

**Accepted trade-offs**:
- The boundary types and the existing implementation types (e.g. `ControlledExecutionRequest` vs `StagingExecutorInputPayload`) are not structurally identical — they will need reconciliation in Phase 11
- The Detector stage has `null` as its current implementation — Phase 11 must add this stage from scratch
- The `confirmation_reference` field on `StagingExecutorInputPayload` is a placeholder for a signed auth token that doesn't exist yet

---

## Phase 11 Implementation Checklist

```typescript
// Phase 11: create a value that satisfies this type.
import type { Phase10OrchestrationBoundary } from "@/lib/phase10-orchestration-boundary";
import {
  PHASE10_ORCHESTRATION_INVARIANTS,
  PIPELINE_STAGE_ORDER,
} from "@/lib/phase10-orchestration-boundary";

export const pipeline = {
  invariants: PHASE10_ORCHESTRATION_INVARIANTS,
  stages: {
    detector:            new IncidentFeedDetector(),           // new in Phase 11
    policy_engine:       new Phase9PolicyEngineAdapter(),      // wraps validateAutomationEligibility
    proposal_engine:     new Phase9ProposalEngineAdapter(),    // wraps suggestAutomationActions
    execution_planner:   new LifecycleStagingPlannerAdapter(), // wraps transitionLifecycle
    staging_executor:    new ControlledExecutionAdapter(),     // wraps validateControlledExecution
    verification_engine: new VerificationEngineAdapter(),      // wraps runVerification
    audit_ledger:        new OperationsTimelineLedgerAdapter(),// wraps operations-timeline repo
  },
  stage_order: PIPELINE_STAGE_ORDER,
} satisfies Phase10OrchestrationBoundary;
```

Each adapter should:
1. Accept the Phase 11 `StageInput<T>` envelope
2. Extract the payload and call the existing Phase 10 function
3. Wrap the result in a `StageOutput<TOk, TErr>` envelope with `execution_granted: false` and `requires_operator_review: true`
4. Pass through to the Audit Ledger stage on every call
