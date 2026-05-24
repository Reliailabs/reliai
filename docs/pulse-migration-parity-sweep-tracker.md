# Pulse Migration Parity Sweep Tracker

Status: Closed (Scoped migration parity and full apps/web parity are contract-closed)
Scope: apps/web -> apps/pulse functional parity

## 1) Current Migration State

### Scope and ownership parity

Resolved and gated by executable tests:
- explicit `project_id` continuity across non-project routes
- deterministic fallback (no implicit first-project assumptions)
- ownership-shift shims:
  - `/projects/[projectId]/control` -> `/projects/[projectId]/reliability`
  - `/organization/settings` -> `/settings`
  - `/model-versions/[id]` -> `/traces?project_id=...&model_version_id=...`
  - `/prompt-versions/[id]` -> `/traces?project_id=...&prompt_version=...`
  - `/regressions/[regressionId]/compare` -> `/operations/regressions/[regressionId]`
  - shared shell consistency across key non-project surfaces (`/playground`, `/regressions`, `/regressions/[id]`)
  - public invite redemption surface (`/join`) is intentionally outside `(app)` and treated as a documented ownership shim for invite acceptance

### Migration gate

Primary parity gate remains:
- `pnpm --filter pulse test:migration-scope-parity-gate`

Runtime continuity coverage remains:
- `pnpm --filter pulse test:e2e:app-route-gate`

`docs/pulse-migration-parity-gaps.json` currently tracks only scope/ownership blockers and is fully resolved.

## 2) Functional Parity Audit Pass

Scoped functional parity is closed for previously tracked migration-contract surfaces, including invite lifecycle delivery contract closure.

Current functional status:
- scoped migration contract surfaces are closed and test-gated
- full apps/web parity is contract-closed and tracked in `docs/pulse-functional-parity-gaps.json` (F1-F6 closed or explicitly externalized with test gates)

Artifacts:
- canonical scope/ownership closure state: `docs/pulse-migration-parity-gaps.json`
- functional audit queue: `docs/pulse-final-functional-migration-gap-report.md`
- system-surface classification matrix: `docs/pulse-system-surface-classification.md`
- read/write parity matrix: `docs/pulse-read-write-parity-matrix.json`
- billing ownership parity register (F1): `docs/pulse-billing-ownership.json`
- API route ownership parity register (F3): `docs/pulse-api-route-ownership.json`
- docs ownership parity register (F5): `docs/pulse-docs-ownership.json`
- unmatched route ownership classification (F6): `docs/pulse-unmatched-route-classification.json`

## 3) Response Team Validation Status

Implemented in Pulse:
- Team Members management: `/settings#team`
- on-call assignment/escalation management: `/on-call` and `/projects/[projectId]/on-call`
- explicit separation of org access roles vs on-call duty roles

Required functional parity checks (closed):
1. Add member in `/settings#team`.
2. Verify member appears in `/on-call` assignment selectors for the same organization/project.
3. Verify project scope switching in `/on-call` does not cross-assign between projects.
4. Verify role naming/labels are consistent and non-conflicting between Team role and On-call role.

Validation artifacts:
- `apps/pulse/tests/response-team-functional-continuity.test.ts`
- `apps/pulse/tests/e2e/app-route-shell.spec.ts` (`on-call` scope continuity probe)

## 4) Rules After Closure

- Any reopened migration work must identify a newly discovered parity gap or a product-level requirement.
- Keep scopes isolated per branch/PR.
- Do not reopen resolved high-impact parity slices without explicit contract updates.
