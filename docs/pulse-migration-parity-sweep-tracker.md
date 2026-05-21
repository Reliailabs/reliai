# Pulse Migration Parity Sweep Tracker

Status: Active (Scope/ownership parity stabilized; functional parity audit in progress)
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

### Migration gate

Primary parity gate remains:
- `pnpm --filter pulse test:migration-scope-parity-gate`

Runtime continuity coverage remains:
- `pnpm --filter pulse test:e2e:app-route-gate`

`docs/pulse-migration-parity-gaps.json` currently tracks only scope/ownership blockers and is fully resolved.

## 2) Functional Parity Audit Pass (Active)

The next migration stage is functional parity vs apps/web behavior, not more scope-routing work.

Active audit focus:
- route behavior parity where Pulse still presents legacy/read-only adapters
- write-path parity gaps that block operator workflows
- placeholder/deferred system surfaces that still indicate incomplete functionality

Artifacts:
- canonical scope/ownership closure state: `docs/pulse-migration-parity-gaps.json`
- functional audit queue: `docs/pulse-final-functional-migration-gap-report.md`

## 3) Response Team Validation Status

Implemented in Pulse:
- Team Members management: `/settings#team`
- on-call assignment/escalation management: `/on-call` and `/projects/[projectId]/on-call`
- explicit separation of org access roles vs on-call duty roles

Required functional parity check (still open):
1. Add member in `/settings#team`.
2. Verify member appears in `/on-call` assignment selectors for the same organization/project.
3. Verify project scope switching in `/on-call` does not cross-assign between projects.
4. Verify role naming/labels are consistent and non-conflicting between Team role and On-call role.

## 4) Rules for Remaining Slices

- No migration slice closes without updating this tracker and the functional gap report.
- Prefer user-visible functional parity fixes over gate/process expansion.
- Keep scopes isolated per branch/PR.
