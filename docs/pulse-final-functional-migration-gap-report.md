# Pulse Functional Parity Audit Report

Date: 2026-05-21
Status: Active
Scope: apps/web -> apps/pulse functional behavior parity (post scope/ownership closure)

## 1) Summary

Scope and ownership migration is materially stabilized and test-gated.

High-impact functional parity gaps are closed and contract-gated. Remaining risk is medium-impact ownership deferment for external invite lifecycle.

## 2) What Is Already Closed

- `project_id` continuity across core non-project routes
- deterministic project resolution (no implicit first-project behavior)
- ownership-shift route shims with canonical query output
- shared-shell alignment on recently migrated non-project surfaces (`/playground`, `/regressions`, `/regressions/[id]`)

Validation backing:
- `pnpm --filter pulse test:migration-scope-parity-gate`
- `pnpm --filter pulse test:e2e:app-route-gate`

## 3) Functional Gap Status

### F1. Response Team end-to-end functional continuity

Classification: `functional continuity gap`  
Impact: `high`
Status: `closed`

Current state:
- Team members are managed in `/settings#team`.
- On-call assignments are managed in `/on-call`.
- End-to-end continuity is explicitly verified by migration parity contract + e2e runtime probes.

Evidence:
1. `apps/pulse/tests/response-team-functional-continuity.test.ts`
2. `apps/pulse/tests/e2e/app-route-shell.spec.ts` (`on-call` scope continuity probe)

### F2. System surface deferment classification

Classification: `deferred behavior delta`  
Impact: `medium`
Status: `closed`

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
Status: `closed`

Current state:
- route-level write matrix is now explicit in `docs/pulse-read-write-parity-matrix.json`.
- high-impact write routes in migration scope are implemented and contract-gated.
- only medium-impact deferred item remains: external invite lifecycle in Team Members.

Action:
- keep the write matrix updated for every migrated write surface change.
- treat any new high-impact unresolved write row as gate failure.

## 4) Immediate Execution Queue

1. Optional product/auth decision: external invite lifecycle ownership (`/settings#team`) beyond migration scope.
2. Keep matrix/tracker sync in every follow-up parity PR.

## 5) Completion Criteria for Functional Parity

Functional parity can be called complete only when:
- all high-impact functional gaps are either implemented or explicitly accepted as exceptions,
- Response Team settings <-> on-call continuity is verified,
- read/write deltas are closed or intentionally deferred with documented decision and phase owner,
- migration tracker and gap report are in sync.
