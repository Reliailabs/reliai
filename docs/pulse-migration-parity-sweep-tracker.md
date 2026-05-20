# Pulse Migration Parity Sweep Tracker

Status: Active
Scope: apps/web -> apps/pulse functionality parity (not route existence only)

## Confirmed Parity Risks

### Project scope consistency

- Pulse onboarding previously relied on ambiguous `listProjects(...?limit=1)` and first-project assumptions.
- Pulse still contains multiple implicit project-resolution paths outside `/projects/[projectId]` routes.
- apps/web patterns consistently preserve explicit `project_id` and/or `[projectId]` scope through route/forms/actions.

Impact:
- wrong-project mutations
- missing/incorrect API key/project continuity
- unstable user context after redirects/actions

### Route ownership gaps (web -> pulse)

Current ownership status:
- `implemented`: `/projects` index -> Pulse project listing at `/projects`
- `ownership shift`: `/projects/[projectId]/control` -> `/projects/[projectId]/reliability`
- `ownership shift`: `/organization/settings` -> `/settings`
- `ownership shift`: `/model-versions/[id]` -> `/traces?project_id=...&model_version_id=...`
- `ownership shift`: `/prompt-versions/[id]` -> `/traces?project_id=...&prompt_version=...`
- `ownership shift`: `/regressions/[regressionId]/compare` -> `/operations/regressions/[regressionId]`

### Functional delta gaps

- Known placeholders/deferred behavior remain on Pulse surfaces.
- Some routes are present but read-only where web behavior is read-write.
- Non-project routes may not preserve project scope contracts consistently.

## Gap Classification Model

Each tracked item must be marked as one of:
- `missing`
- `read-only delta`
- `ownership shift`
- `intentional exception`

Each item also needs:
- source behavior reference (apps/web path)
- pulse behavior reference (apps/pulse path)
- user impact level (`high|medium|low`)
- migration decision (`implement|defer|accept-exception`)

## Active Fix Slice (In Progress)

1. Add shared `ProjectScopeSelector` component in Pulse.
2. Persist scope via `project_id` query on non-project routes:
   - `/incidents`
   - `/incidents/[incidentId]`
   - `/traces`
   - `/traces/[traceId]`
   - `/traces/[traceId]/compare`
   - `/traces/[traceId]/graph`
   - `/audits/new`
   - `/onboarding`
   - `/audits`
   - `/audits/[id]`
   - `/audits/[id]/results`
   - `/metrics`
   - `/deployments`
   - `/deployments/[deploymentId]`
   - `/regressions`
   - `/regressions/[regressionId]`
3. Remove implicit “pick first project” fallbacks:
   - prefer explicit selected `project_id`
   - fallback to deterministic newest project only when no explicit scope exists
   - surface selected scope in UI
4. Add regression tests that fail on first-project implicit regression.

Pending:
- Validate FastAPI `/api/v1/operations/timeline` handling of `project_id` end-to-end in live mode and add explicit API contract tests.

## Sweep Execution Plan

1. Build executable web->pulse route + behavior inventory.
2. Classify every gap with the model above.
3. Add migration gate check so unresolved high-impact gaps block closure.
4. Execute blockers by user impact priority:
   - onboarding/project scope/incidents first
   - then route ownership and read/write parity gaps

## Notes

- This tracker is operational, not archival.
- No new migration slice closes until it updates this tracker.
