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
- `/system/customers/[projectId]` parity is now implemented in Pulse with legacy alias preservation.

Action:
- keep the classification matrix updated for every system-surface change.
- keep legacy aliases redirect-only (no duplicate owned UI surfaces).

### F3. Read/write parity matrix is explicit and gate-backed

Classification: `read/write delta`  
Impact: `medium`

Current state:
- route-level write matrix is now explicit in `docs/pulse-read-write-parity-matrix.json`.
- high-impact write routes in migration scope are implemented and contract-gated.
- only medium-impact deferred item remains: external invite lifecycle in Team Members.

Action:
- keep the write matrix updated for every migrated write surface change.
- treat any new high-impact unresolved write row as gate failure.

## 4) Immediate Execution Queue

1. Response Team functional verification slice (F1) with explicit test/probe outputs.
2. Response Team runtime verification probe extension (cross-project assignment isolation).
3. Medium-impact deferred invite lifecycle ownership decision (`/settings#team` external invites).

## 5) Completion Criteria for Functional Parity

Functional parity can be called complete only when:
- all high-impact functional gaps are either implemented or explicitly accepted as exceptions,
- Response Team settings <-> on-call continuity is verified,
- read/write deltas are closed or intentionally deferred with documented decision and phase owner,
- migration tracker and gap report are in sync.
