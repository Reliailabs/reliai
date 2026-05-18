# Pulse Migration Audit Sheet

## Gate Rule (Locked)
No net-new capability implementation may begin until source migration parity is classified for the affected feature.

Phase 9 implementation may proceed only when an item is either:
- `Migration` with `Parity reached`, or
- `Net-new` with explicit approval.

## Locked Scope Decision (2026-05-13)
- Migration readiness target is `apps/web operational parity`, not full app parity.
- Keep in `apps/web` for now: `/docs`, `/docs-marketing`, `/pricing`, `/signup` (Pulse now provides explicit `/signup` compatibility shim redirect in `P12.5`).
- Required in `apps/pulse` before readiness: `/projects/[projectId]/reliability`, `/projects/[projectId]/regressions`, `/projects/[projectId]/timeline`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/processors`, `/projects/[projectId]/settings`, `/playground`.
- Conditional ownership routes explicitly retained in `apps/web` for this migration gate: `/settings/billing`, `/billing/success` (`/onboarding` moved to Pulse in `M8.1`).
- Migration gate closure achieved in `M9.3`; Phase 9 is unblocked for explicitly approved `Net-new` slices.

## Status Vocabulary
- `Not started`
- `Deferred`
- `Complete`
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
| Incidents deep links + detail flow | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/components/presenters/incident-detail-view.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/incidents/[incidentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/incidents/[incidentId]/investigate/page.tsx` | `/incidents`, `/incidents/[incidentId]`, `/incidents/[incidentId]/investigate`, `/incidents/[incidentId]/compare`, `/incidents/[incidentId]/command` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (`getIncident`, incident timeline/actions) | app session + org/project scoping in app routes | incident summary/detail, severity, status, linked traces/deployments/evidence | `/incidents`, `/incidents/[incidentId]`, `/incidents/[incidentId]/investigate`, `/incidents/[incidentId]/compare` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/[incidentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/[incidentId]/investigate/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/incidents/[incidentId]/compare/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/incidents-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/operations/incident-operations-surface.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/incidents-data.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/incident-deeplink-alias.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/incidents/[id]/acknowledge/route.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/incidents/[id]/resolve/route.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/incidents/[id]/reopen/route.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/incidents/[id]/assign/route.ts` | Complete | Migration | No | M9.1 closed the deferred deep-link delta by mapping investigate/compare routes to parity-safe operations incident tabs with no net-new behavior. |
| Audits detail/results/new | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/[id]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/[id]/results/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/audits/new/page.tsx` | `/audits`, `/audits/[id]`, `/audits/[id]/results`, `/audits/new` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (audit list/detail/run artifacts) | app session + org/project guard | audit entity, recent runs, stage status, findings, artifacts | `/audits`, `/audits/[id]`, `/audits/[id]/results`, `/audits/new` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/[id]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/[id]/results/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/audits/new/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/audits-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/audits-data.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/audits/[id]/detail/route.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/audits/[id]/actions/route.ts` | Complete | Migration | No | M8.3 closure reached: action semantics parity (`new_run`, `start`, `continue`, `rerun stage`) and results/detail presenter parity coverage are implemented and CI-enforced through M8 suite. |
| Traces detail routes | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/compare/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/traces/[traceId]/graph/page.tsx` | `/traces`, `/traces/[traceId]`, `/traces/[traceId]/compare`, `/traces/[traceId]/graph` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (trace list/detail/graph, risk patterns) | app session + org scope | trace overview, span/event graph, comparisons, linked incidents/deployments | `/traces`, `/traces/[traceId]`, `/traces/[traceId]/compare`, `/traces/[traceId]/graph` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/compare/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/traces/[traceId]/graph/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/performance-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/traces-data.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/trace-forensics-mapper.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/traces/[id]/forensics/route.ts` | Complete | Migration | No | M8.4 closure reached with detail/compare/graph presenter parity and rendered smoke coverage; no net-new scoring/explanation semantics introduced. |
| Deployments detail | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/deployments/[deploymentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/components/presenters/deployment-detail-view.tsx` | `/deployments/[deploymentId]` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (deployment detail/intelligence signals) | app session + org/project scope | deployment metadata, correlated incidents/regressions, risk explanations | `/deployments`, `/deployments/[deploymentId]` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/deployments/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/deployments/[deploymentId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/deployments-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/deployments-data.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/deployment-detail-mapper.ts`, `/Users/robert/Documents/Reliai/apps/pulse/app/api/deployments/[id]/detail/route.ts` | Complete | Migration | No | M8.5 closure reached with mapped deployment detail presenter parity and presenter smoke coverage; risk/correlation are mapped from source contract fields only. |
| Project-scoped routes family | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/projects/[projectId]/*` pages | `/projects/[projectId]/control`, `/projects/[projectId]/deployments`, `/projects/[projectId]/guardrails`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/metrics`, `/projects/[projectId]/processors`, `/projects/[projectId]/regressions`, `/projects/[projectId]/reliability`, `/projects/[projectId]/settings`, `/projects/[projectId]/timeline` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` (project scoped endpoints) | app session + org membership + project access guard | project-centric operational and governance views | `/projects/[projectId]`, `/projects/[projectId]/incidents`, `/projects/[projectId]/audits`, `/projects/[projectId]/traces`, `/projects/[projectId]/deployments`, `/projects/[projectId]/guardrails`, `/projects/[projectId]/metrics`, `/projects/[projectId]/reliability`, `/projects/[projectId]/regressions`, `/projects/[projectId]/timeline`, `/projects/[projectId]/ingestion`, `/projects/[projectId]/processors`, `/projects/[projectId]/settings` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/incidents/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/audits/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/traces/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/deployments/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/guardrails/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/metrics/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/reliability/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/regressions/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/timeline/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/ingestion/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/processors/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/projects/[projectId]/settings/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/project-reliability-surface.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/project-reliability-mapper.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/regression-list-mapper.ts` | Parity reached | Migration | No | M8.6 deepened project reliability/regressions presenters to source-contract depth while preserving read-only boundaries and project auth scoping. |
| Settings/onboarding/billing/docs/playground portability | `apps/web` | `/Users/robert/Documents/Reliai/apps/web/app/(app)/settings/*`, `/Users/robert/Documents/Reliai/apps/web/app/(onboarding)/onboarding/page.tsx`, `/Users/robert/Documents/Reliai/apps/web/app/(marketing)/docs*`, `/Users/robert/Documents/Reliai/apps/web/app/(app)/playground/page.tsx`, billing pages | `/settings`, `/settings/billing`, `/onboarding`, `/docs`, `/docs-marketing`, `/playground`, `/billing/success` | `/Users/robert/Documents/Reliai/apps/web/lib/api.ts` + auth/session helpers | mixed: app auth + some public marketing/docs | mixed data: settings profiles/integrations/security, onboarding state, docs content, billing callbacks | `/settings`, `/playground`, `/onboarding`, `/settings/billing`, `/billing/success` | `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/settings/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/settings/billing/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/billing/success/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/playground/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/app/(app)/onboarding/page.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/components/dashboard/content/settings-content.tsx`, `/Users/robert/Documents/Reliai/apps/pulse/lib/settings-data.ts`, `/Users/robert/Documents/Reliai/apps/pulse/lib/onboarding-data.ts` | Complete (compatibility shim) | Migration | No | `M9.2` closed the conditional ownership delta for migration compatibility by adding explicit Pulse shims for `/settings/billing` and `/billing/success` while keeping full billing feature ownership in `apps/web`. |
| Phase 8 validator guard runtime | `apps/pulse` docs/contracts | `/Users/robert/Documents/Reliai/apps/pulse/app/api/controlled-execution/*` (validation-only guards) | API-only (no source route in `apps/web`) | phase8 validator envelope + guard contracts in pulse | strict validation-only + auth guard | controlled execution request envelope metadata | API under pulse only | `apps/pulse/app/api/controlled-execution/*`, `apps/pulse/tests/*` | Parity reached (for pulse plan) | Net-new | Yes | not a migration item; already approved/implemented as new foundation |
| Phase 9 assisted automation proposals | n/a (new plan track) | planned docs in `/Users/robert/Documents/Reliai/docs/pulse-phase9-*` | planned pilot in incident workflows | planned policy gate + evidence receipt contracts | must be operator-confirmed + policy bounded | proposal/staging/evidence receipt models | TBD (after parity gate) | TBD | Net-new candidate | Net-new | Yes | blocked until migration parity classification complete per gate rule |

## Enforcement Checklist (before any new feature PR)
1. Identify touched feature row in this sheet.
2. Confirm `classification`.
3. If `Migration`: target `Complete` or `Parity reached`, or document a `Deferred` delta with explicit owner/phase.
4. If `Net-new`: obtain explicit approval and reference it in PR body.
5. Confirm no source-of-truth contradiction in `source_logic_files` and `source_api_contracts`.
6. Confirm the change does not violate the locked scope decision above.
7. Complete the route contract entry required by `docs/agent-migration-contract-rules.md` for each `M7+` slice.
8. For any `P12.x` follow-up, include the **Required PR body snippet** from `docs/phase12-demo-audit-signup-migration-plan.md`.
9. For any `P12.x` follow-up, include a link to the successful `pulse-route-gate` run in the PR body (`ci_proof` field).
10. Before merging any `P12.x` follow-up PR, record explicit check-query evidence from `gh pr view ... statusCheckRollup` or `gh pr checks --watch`.

## Linked Migration Plans
- `docs/agent-migration-contract-rules.md`
- `docs/pulse-app-route-migration-gate.md`
- `docs/pulse-m7-deferred-project-routes-audit.md`
- `docs/pulse-m7-8-conditional-ownership-decision.md`
- `docs/pulse-m8-1-onboarding-ownership-transfer.md`
- `docs/phase12-demo-audit-signup-migration-plan.md`
- `docs/pulse-m6-oncall-response-team-implementation-plan.md`
- `docs/pulse-m6-oncall-response-team-sidebar-integration-plan.md`
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

## M8.7 Closure Note
- Code migration gate passed for M8-owned slices.
- CI migration gate is wired and enforced (`pnpm --filter pulse test:m8-migration-parity` in `pulse-route-gate`).
- Docs reconciled to remove contradictory M8 status/path entries.
- Known public route exception remains intentional: `apps/pulse/app/(marketing)/page.tsx`.
- `AGENTS.md` drift exists locally and is explicitly excluded from M8 closure scope.

## M9.3 Migration Gate Closure Note
- Migration parity matrix rows are now either `Complete`, `Complete (compatibility shim)`, or `Parity reached` for in-scope migration routes.
- Deferred incident deep-link parity (`M9.1`) and conditional billing ownership compatibility (`M9.2`) are closed.
- CI enforcement is active in `pulse-route-gate`, including:
  - `pnpm --filter pulse test:app-route-gate`
  - `pnpm --filter pulse test:m8-migration-parity`
  - `pnpm --filter pulse test:e2e:app-route-gate:ci` (strict auth creds required)
- Phase 9 work may proceed only for explicitly approved `Net-new` slices per this sheet’s classification and approval rules.

## P12 Closure Note
- Phase 12 route ownership, deterministic demo integrity, and contract-consumption slices are implemented and merged through `P12.26`.
- CI enforcement remains active via:
  - `pnpm --filter pulse test:phase12-route-ownership-gate`
  - wired in `.github/workflows/qa.yml` under `pulse-route-gate`.
- Source-of-truth contract/gate reference:
  - `docs/phase12-demo-audit-signup-migration-plan.md`
- Manual reviewer invariants for future P12 follow-ups:
  - deterministic and replayable demo behavior
  - no presenter-side reinterpretation of integrity semantics
  - CTA label/destination behavior alignment
  - no live provider dependency in demo runtime state

## P13 Closure Note
- Phase 13 validation-only write-path contracts are aggregated under:
  - `pnpm --filter pulse test:phase13-closure-gate`
- CI enforcement is wired in `.github/workflows/qa.yml` under `pulse-route-gate`.
