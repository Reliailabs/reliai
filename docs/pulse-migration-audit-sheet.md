# Pulse Migration Audit Sheet

## Gate Rule (Locked)
No net-new capability implementation may begin until source migration parity is classified for the affected feature.

Phase 9 implementation may proceed only when an item is either:
- `Migration` with `Parity reached`, or
- `Net-new` with explicit approval.

## Locked Scope Decision (2026-05-13)
- Migration readiness target is `apps/web operational parity`, not full app parity.
- Keep in `apps/web` for now: `/docs`, `/docs-marketing`, `/pricing`, `/signup`.
- Required in `apps/pulse` before readiness: `/projects/[projectId]/reliability`, `/projects/[projectId]/regressions`, `/projects/[projectId]/timeline`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/processors`, `/projects/[projectId]/settings`, `/playground`.
- Conditional ownership routes explicitly retained in `apps/web` for this migration gate: `/settings/billing`, `/billing/success`, `/onboarding`.
- Phase 9 expansion remains blocked until this migration gate is closed.

## Status Vocabulary
- `Not started`
- `Partial`
- `Parity reached`
- `Blocked`
- `Net-new candidate`

## Classification Vocabulary
- `Migration`
- `Net-new`
- `UI-only reference`
- `Deprecated / do not migrate`

## Priority Migration Matrix

| feature | source_app | source_logic_files | source_route | source_api_contracts | source_auth_or_role_guards | source_data_shape | pulse_target_route | pulse_target_files | pulse_parity_status | classification | approval_required | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Incidents deep links + detail flow | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/components/presenters/incident-detail-view.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/incidents/[incidentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/incidents/[incidentId]/investigate/page.tsx` | `/incidents`, `/incidents/[incidentId]`, `/incidents/[incidentId]/investigate`, `/incidents/[incidentId]/compare`, `/incidents/[incidentId]/command` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (`getIncident`, incident timeline/actions) | app session + org/project scoping in app routes | incident summary/detail, severity, status, linked traces/deployments/evidence | `/incidents`, `/incidents/[incidentId]` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/[incidentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/incidents-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/incidents-data.ts` | Partial | Migration | No | list + incident deep-link route migrated; investigate/compare/command detail actions pending |
| Audits detail/results/new | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/[id]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/[id]/results/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/new/page.tsx` | `/audits`, `/audits/[id]`, `/audits/[id]/results`, `/audits/new` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (audit list/detail/run artifacts) | app session + org/project guard | audit entity, recent runs, stage status, findings, artifacts | `/audits`, `/audits/[id]`, `/audits/[id]/results`, `/audits/new` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/[id]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/[id]/results/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/new/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/audits-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/audits-data.ts` | Partial | Migration | No | route-level detail/results/new parity added; full stage actions/results presenter parity still pending |
| Traces detail routes | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/compare/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/graph/page.tsx` | `/traces`, `/traces/[traceId]`, `/traces/[traceId]/compare`, `/traces/[traceId]/graph` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (trace list/detail/graph, risk patterns) | app session + org scope | trace overview, span/event graph, comparisons, linked incidents/deployments | `/traces`, `/traces/[traceId]`, `/traces/[traceId]/compare`, `/traces/[traceId]/graph` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/compare/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/graph/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/performance-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/traces-data.ts` | Partial | Migration | No | route-level detail/compare/graph parity added; full forensic presenter parity still pending |
| Deployments detail | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/deployments/[deploymentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/components/presenters/deployment-detail-view.tsx` | `/deployments/[deploymentId]` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (deployment detail/intelligence signals) | app session + org/project scope | deployment metadata, correlated incidents/regressions, risk explanations | `/deployments`, `/deployments/[deploymentId]` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/deployments/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/deployments/[deploymentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/deployments-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/deployments-data.ts` | Partial | Migration | No | route-level detail parity added; full deployment detail presenter parity still pending |
| Project-scoped routes family | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/projects/[projectId]/*` pages | `/projects/[projectId]/control`, `/projects/[projectId]/deployments`, `/projects/[projectId]/guardrails`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/metrics`, `/projects/[projectId]/processors`, `/projects/[projectId]/regressions`, `/projects/[projectId]/reliability`, `/projects/[projectId]/settings`, `/projects/[projectId]/timeline` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (project scoped endpoints) | app session + org membership + project access guard | project-centric operational and governance views | `/projects/[projectId]`, `/projects/[projectId]/incidents`, `/projects/[projectId]/audits`, `/projects/[projectId]/traces`, `/projects/[projectId]/deployments`, `/projects/[projectId]/guardrails`, `/projects/[projectId]/metrics`, `/projects/[projectId]/reliability`, `/projects/[projectId]/regressions`, `/projects/[projectId]/timeline`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/processors`, `/projects/[projectId]/settings` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/incidents/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/deployments/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/guardrails/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/metrics/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/reliability/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/regressions/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/timeline/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/ingestion/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/processors/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/settings/page.tsx` | Parity reached | Migration | No | Required M7 route set and deferred write-parity slices (`M7.4b`, `M7.5b`, `M7.6b`) are complete. Auth return-path preservation for deep links is also complete in proxy protection. |
| Settings/onboarding/billing/docs/playground portability | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/settings/*`, `/Users/robert/Documents/Reliai/apps/web/app/(auth)/onboarding/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(marketing)/docs*`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/playground/page.tsx`, billing pages | `/settings`, `/settings/billing`, `/onboarding`, `/docs`, `/docs-marketing`, `/playground`, `/billing/success` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` + auth/session helpers | mixed: app auth + some public marketing/docs | mixed data: settings profiles/integrations/security, onboarding state, docs content, billing callbacks | `/settings`, `/playground`, other routes TBD | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/settings/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/playground/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/settings-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/settings-data.ts` | Parity reached | Migration | No | Scoped portability decision is complete: Pulse owns `/settings` and `/playground`; `/settings/billing`, `/onboarding`, and `/billing/success` are explicitly retained in `apps/web` per M7.8 waiver decision. |
| Phase 8 validator guard runtime | `apps/pulse` docs/contracts | `/Users/robert/Documents/Reliai/apps/pulse/app/api/controlled-execution/*` (validation-only guards) | API-only (no source route in `apps/web`) | phase8 validator envelope + guard contracts in pulse | strict validation-only + auth guard | controlled execution request envelope metadata | API under pulse only | `apps/pulse/app/api/controlled-execution/*`, `apps/pulse/tests/*` | Parity reached (for pulse plan) | Net-new | Yes | not a migration item; already approved/implemented as new foundation |
| Phase 9 assisted automation proposals | n/a (new plan track) | planned docs in `/Users/robert/Documents/Reliai/docs/pulse-phase9-*` | planned pilot in incident workflows | planned policy gate + evidence receipt contracts | must be operator-confirmed + policy bounded | proposal/staging/evidence receipt models | TBD (after parity gate) | TBD | Net-new candidate | Net-new | Yes | blocked until migration parity classification complete per gate rule |

## Enforcement Checklist (before any new feature PR)
1. Identify touched feature row in this sheet.
2. Confirm `classification`.
3. If `Migration`: target `Parity reached` or document `Partial` gap being closed.
4. If `Net-new`: obtain explicit approval and reference it in PR body.
5. Confirm no source-of-truth contradiction in `source_logic_files` and `source_api_contracts`.
6. Confirm the change does not violate the locked scope decision above.

## Linked Migration Plans
- `docs/pulse-m7-deferred-project-routes-audit.md`
- `docs/pulse-m7-8-conditional-ownership-decision.md`
- `docs/pulse-m8-1-onboarding-ownership-transfer.md`
- `docs/pulse-m6-portability-classification-audit.md`
- `docs/pulse-m5-4-project-parity-closure-audit.md`
- `docs/pulse-project-scoped-parity-plan.md`
- `docs/pulse-remaining-migration-docs-plan.md`

## Queued Follow-Up Slices (Deferred Write-Parity Register)
- `M7.4b` — Ingestion write parity (`/projects/[projectId]/ingestion`)
  - reason: current Pulse route is read-only while source `apps/web` includes policy update actions
  - scope: ingestion policy updates (sampling/retention/cardinality) using existing source contracts
  - status: completed on 2026-05-13
- `M7.5b` — Processors write parity (`/projects/[projectId]/processors`)
  - reason: current Pulse route is read-only while source `apps/web` behavior is read-write
  - scope: create/edit/enable/disable using existing source contracts
  - status: completed on 2026-05-13
- `M7.6b` — Project settings write parity (`/projects/[projectId]/settings`)
  - reason: current Pulse route is read-only while source `apps/web` includes project profile update actions
  - scope: update project name/slug/description using existing source contracts
  - status: completed on 2026-05-13

## M7.9 Gate Update
- Pulse lint gate strengthened from narrow file selection to full app lint execution (`pnpm --filter pulse lint` -> `eslint .`).
- Current state: gate passes with warnings; warning debt is tracked but does not block route-parity slice completion.
