# Phase 10 — Proposal Lifecycle Model

## Purpose

Defines the typed lifecycle state machine for automation proposals introduced in Phase 10.1. This model bridges the Phase 9 validation layer (proposal generation, impact preview, operator confirmation, evidence receipt) with the Phase 10 operational surface (operations timeline, verification engine, reliability scoring).

## Core Invariant

`execution_granted` is always `false` on every `ProposalLifecycle` entity.

"executing" is a **lifecycle label** — it represents the window between operator confirmation and outcome verification. It does not grant Reliai authority to perform live production mutations.

This invariant is enforced at two levels:
- **Type level**: `execution_granted: false` is a TypeScript literal type, not `boolean`. The compiler rejects any assignment of `true`.
- **Runtime level**: Every service function that produces or saves a `ProposalLifecycle` sets this field to `false` explicitly.

---

## States

```
detected
  └── analyzed
        └── proposed
              └── staged
                    └── approved
                          └── executing ──► verified   (terminal)
                          │                 failed      (terminal)
                          │                 rolled_back (terminal)
                          └── expired      (terminal — any non-terminal state)
```

### State Definitions

| State | Meaning |
|---|---|
| `detected` | A reliability signal (incident, regression, deployment anomaly) has been detected and a proposal candidate created. |
| `analyzed` | Evidence has been gathered and the proposal has been assessed for automation eligibility (Phase 9 gate checks). |
| `proposed` | A concrete remediation proposal has been generated with impact preview and blast radius assessment. |
| `staged` | The proposal has been staged for operator review — non-mutating preview of steps, constraints, and impact. |
| `approved` | An operator has confirmed the proposal (Phase 9 operator confirmation contract satisfied). Evidence receipt emitted. |
| `executing` | The proposal has entered the controlled execution workflow boundary. **`execution_granted` remains `false`.** |
| `verified` | Outcome verified: a `VerificationResult` (Phase 10.3) confirms the proposal produced a measurable improvement. |
| `failed` | Execution entered an error state. No rollback performed. `failure_reason` recorded. |
| `rolled_back` | Execution entered an error state and rollback was initiated. `failure_reason` records the cause. |
| `expired` | The lifecycle TTL elapsed before the operator acted. No further transitions are possible. |

### Terminal States

`verified`, `failed`, `rolled_back`, `expired` — no transitions out.

---

## Valid Transitions

| From | To (allowed) |
|---|---|
| `detected` | `analyzed`, `expired` |
| `analyzed` | `proposed`, `expired` |
| `proposed` | `staged`, `expired` |
| `staged` | `approved`, `expired` |
| `approved` | `executing`, `expired` |
| `executing` | `verified`, `failed`, `rolled_back` |
| *(terminal)* | *(none)* |

Any unlisted transition is rejected with an explicit error. Transitions are forward-only — no backwards moves.

---

## Entity Shape

```typescript
type ProposalLifecycle = {
  readonly lifecycle_id: string;          // "lifecycle-" + 16-char sha256
  readonly proposal_id: string;           // references Phase 9 phase9-* format
  readonly action_type: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly organization_id: string;
  readonly created_at: string;            // ISO 8601
  readonly expires_at: string;            // ISO 8601, default 24h TTL
  readonly execution_granted: false;      // invariant — NEVER true
  readonly requires_operator_review: true;
  state: ProposalLifecycleState;
  updated_at: string;
  operator_email: string | null;          // set at approved / executing
  verification_result_id: string | null;  // set at verified
  failure_reason: string | null;          // set at failed / rolled_back
  state_history: LifecycleStateHistoryEntry[];
};
```

### lifecycle_id generation

Deterministic: `"lifecycle-" + sha256(proposal_id + ":" + created_at).hex.slice(0, 16)`.

The same `proposal_id` + `created_at` pair always produces the same `lifecycle_id`, making receipts auditable without a database lookup.

---

## Service Functions

All functions are pure TypeScript with no I/O. Repository injection is via optional parameter (default: module-level `InMemoryProposalLifecycleRepository`).

| Function | Description |
|---|---|
| `getLifecycleById(lifecycleId, repo?)` | Fetch a single lifecycle by ID. Returns `null` if not found. |
| `listLifecycles(filter?, repo?)` | List lifecycles with optional `{ organization_id, state, proposal_id }` filter. |
| `transitionLifecycle(lifecycleId, toState, reason, repo?, now?)` | Generic transition — validates edge, checks expiry, rejects terminal states, appends to `state_history`. |
| `completeProposalExecution(lifecycleId, operatorEmail, repo?, now?)` | Specific: `approved → executing`. Records operator email. Emits invariant warning. |
| `verifyProposalOutcome(lifecycleId, verificationResultId, repo?, now?)` | Specific: `executing → verified`. Records `verification_result_id`. |
| `failProposalExecution(lifecycleId, failureReason, rollback, repo?, now?)` | Specific: `executing → failed \| rolled_back`. Set `rollback=true` for structured rollback. |

### Return type

All transition functions return:
```typescript
type LifecycleTransitionResult =
  | { ok: true; lifecycle: ProposalLifecycle; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };
```

`ok: false` is always accompanied by at least one `errors` entry. No exceptions are thrown.

---

## Repository Interface

```typescript
interface ProposalLifecycleRepository {
  findById(lifecycleId: string): ProposalLifecycle | null;
  findAll(filter?: LifecycleFilter): ProposalLifecycle[];
  save(lifecycle: ProposalLifecycle): ProposalLifecycle;
}
```

Phase 10 ships with `InMemoryProposalLifecycleRepository` (fixture-backed). Phase 11 replaces this with a DB-backed implementation at the `defaultRepository` assignment in `proposal-lifecycle.ts`. No service function or consumer code changes required.

---

## Relationship to Phase 9

Phase 10 lifecycles reference Phase 9 artifacts but do not rewrite them:

| Phase 9 artifact | Phase 10 usage |
|---|---|
| `proposal_id` (phase9-* format) | Referenced by `ProposalLifecycle.proposal_id` |
| `validateAutomationEligibility()` | Called before `detected → analyzed` to confirm eligibility |
| `validateOperatorConfirmation()` | Called before `staged → approved` |
| `emitEvidenceReceipt()` | Called when transitioning to `approved`; receipt ID stored externally |
| `buildImpactPreview()` | Used during `proposed` state to present blast radius and reversibility |

Phase 10 does not import or modify any Phase 9 functions.

---

## Expiry

- Default TTL: 24 hours from `created_at`.
- Any non-terminal lifecycle past its `expires_at` rejects transitions to non-`expired` states.
- To clean up an expired lifecycle, call `transitionLifecycle(id, "expired", reason)`.

---

## Implementation File

`apps/pulse/lib/proposal-lifecycle.ts`

Tests: `apps/pulse/tests/proposal-lifecycle.test.ts` (35 tests, all passing)
