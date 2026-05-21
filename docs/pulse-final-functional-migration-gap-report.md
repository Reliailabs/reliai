# Pulse Functional Parity Audit Report

Date: 2026-05-21
Status: Active
Scope: apps/web -> apps/pulse functional behavior parity (post scope/ownership closure)

## 1) Summary

Scope and ownership migration is materially stabilized and test-gated.

Functional parity is not complete yet. Remaining risk is no longer route existence; it is behavior parity (especially write-path and deferred system surfaces).

## 2) What Is Already Closed

- `project_id` continuity across core non-project routes
- deterministic project resolution (no implicit first-project behavior)
- ownership-shift route shims with canonical query output
- shared-shell alignment on recently migrated non-project surfaces (`/playground`, `/regressions`, `/regressions/[id]`)

Validation backing:
- `pnpm --filter pulse test:migration-scope-parity-gate`
- `pnpm --filter pulse test:e2e:app-route-gate`

## 3) High-Impact Open Functional Gaps

### F1. Response Team end-to-end functional continuity

Classification: `functional continuity gap`  
Impact: `high`

Current state:
- Team members are managed in `/settings#team`.
- On-call assignments are managed in `/on-call`.
- Separation is implemented, but end-to-end continuity needs explicit parity verification.

Required parity checks:
1. invite/add member in settings.
2. verify immediate assignment availability in on-call role selectors.
3. verify project scope changes do not leak assignment context.
4. verify labels are unambiguous between access role and on-call duty role.

### F2. System surface deferment classification

Classification: `deferred behavior delta`  
Impact: `medium`

Current state:
- classification is now explicit in `docs/pulse-system-surface-classification.md`.
- legacy aliases are documented as `intentional exception`.
- only one known deferment remains: `/system/customers/[projectId]`.

Action:
- keep the classification matrix updated for every system-surface change.
- implement the deferred project-detail customer route in the next functional parity batch.

### F3. Read-only vs write-path parity matrix is incomplete

Classification: `read/write delta`  
Impact: `high`

Current state:
- multiple migrated routes are present and navigable, but not all apps/web write capabilities are confirmed in Pulse.

Action:
- produce explicit write-capability matrix per route (create/edit/approve/execute/rollback where applicable).
- tag each gap with migration decision and target phase.

## 4) Immediate Execution Queue

1. Response Team functional verification slice (F1) with explicit test/probe outputs.
2. Read/write capability matrix slice (F3) and prioritized implementation queue.
3. Deferred system customer-project detail route implementation (`/system/customers/[projectId]` parity).

## 5) Completion Criteria for Functional Parity

Functional parity can be called complete only when:
- all high-impact functional gaps are either implemented or explicitly accepted as exceptions,
- Response Team settings <-> on-call continuity is verified,
- read/write deltas are closed or intentionally deferred with documented decision and phase owner,
- migration tracker and gap report are in sync.
