# Pulse M8 — Deferred Migration Features Backlog

Date: 2026-05-14
Status: In progress (`M8.1` accepted, `M8.2` implemented, validation pending)
Classification: Migration

## Why This Exists
M7 closed required project-route parity and write-parity follow-ups, but source migration still has deferred feature slices.
This document is the single queue for those deferred migration features so they are not lost or silently waived.

## Deferred Migration Slices (M8 Queue)

### M8.1 — Onboarding Ownership Transfer
- Current state: Pulse now owns `/onboarding` route implementation.
- Pulse target: validate and accept ownership transfer with migration contract checks.
- Scope:
  1. Add Pulse-owned `/onboarding` route.
  2. Reuse source onboarding contracts/presenter behavior where safe.
  3. Preserve auth/session, deep-link return-path, and post-onboarding destinations.
  4. No net-new onboarding behavior.

#### M8.1 Implementation Notes (2026-05-13)
- Added Pulse route: `apps/pulse/app/onboarding/page.tsx`
- Added Pulse onboarding helpers: `apps/pulse/lib/onboarding-data.ts`
- Added simulation proxies:
  - `apps/pulse/app/api/onboarding/simulations/route.ts`
  - `apps/pulse/app/api/onboarding/simulations/[simulationId]/status/route.ts`
- Added onboarding components:
  - `apps/pulse/components/onboarding/onboarding-path-tracker.tsx`
  - `apps/pulse/components/onboarding/onboarding-simulation-runner.tsx`

### M8.2 — Incident Detail Action Parity
- Current state: incident list/detail exists in Pulse; source investigation/compare/command flows are not fully ported.
- Pulse target: close parity for `/incidents/[incidentId]/investigate`, `/incidents/[incidentId]/compare`, `/incidents/[incidentId]/command` behavior.
- Scope:
  1. Port source read contracts and presenter actions used in investigation workflow.
  2. Keep execution/approval boundaries consistent with existing Pulse governance.
  3. No autonomous action behavior.

#### M8.2 Implementation Notes (2026-05-14)
- Preserved existing Pulse route ownership for:
  - `apps/pulse/app/(app)/incidents/[incidentId]/page.tsx`
  - `apps/pulse/app/(app)/incidents/[incidentId]/command/page.tsx`
- Added lifecycle action proxy routes:
  - `apps/pulse/app/api/incidents/[id]/acknowledge/route.ts`
  - `apps/pulse/app/api/incidents/[id]/resolve/route.ts`
  - `apps/pulse/app/api/incidents/[id]/reopen/route.ts`
- Corrected owner assignment contract path in:
  - `apps/pulse/app/api/incidents/[id]/assign/route.ts` (`/owner` endpoint)
- Added incident-detail action UI wiring in:
  - `apps/pulse/components/dashboard/content/incidents-content.tsx`
  - actions: `Acknowledge`, `Resolve`, `Reopen`, assignment update
  - state sync: list/detail status + assignee refresh after action

### M8.3 — Audit Stage/Results Action Parity
- Current state: audits routes are present; full stage-action/results presenter parity remains partial.
- Pulse target: source-equivalent audit action/results behavior on existing routes.
- Scope:
  1. Port missing audit stage actions from source route behavior.
  2. Ensure results/detail data shape parity.
  3. Preserve auth/project scoping and non-destructive defaults.

#### M8.3 Implementation Notes (2026-05-14)
- Added Pulse audit detail + action proxies:
  - `apps/pulse/app/api/audits/[id]/detail/route.ts`
  - `apps/pulse/app/api/audits/[id]/actions/route.ts`
- Added explicit audit action contract mapping:
  - `apps/pulse/lib/audits-action-contract.ts`
  - `new_run`, `start`, `continue`, `rerun(stage)` path resolution
- Added action availability + failure-state guard helpers:
  - `apps/pulse/lib/audits-surface-actions.ts`
- Wired detail-context action controls in:
  - `apps/pulse/components/dashboard/content/audits-content.tsx`
  - non-optimistic update model: action success triggers detail refresh; failure does not mutate local stage/run state.
- Added focused tests:
  - `apps/pulse/tests/audits-action-parity.test.ts`
  - script: `pnpm --filter pulse test:audit-action-parity`

### M8.4 — Trace Forensics Presenter Parity
- Current state: trace detail/compare/graph routes exist; full forensic presenter behavior remains partial.
- Pulse target: source-equivalent trace deep-dive behavior on existing routes.
- Scope:
  1. Port missing compare/graph/detail presenter logic and data mappings.
  2. Preserve incident/deployment linkage semantics.
  3. No new trace feature expansion.

#### M8.4 Implementation Notes (2026-05-14)
- Added trace forensics read proxy:
  - `apps/pulse/app/api/traces/[id]/forensics/route.ts`
- Added presenter mapping layer from existing web/API contracts:
  - `apps/pulse/lib/trace-forensics-mapper.ts`
- Wired trace route context panels in:
  - `apps/pulse/components/dashboard/content/performance-content.tsx`
  - detail/compare/graph route modes now render mapped forensics data (metadata, key findings, compare summary, graph summary) instead of parity-pending placeholder text.
- Added focused mapping tests:
  - `apps/pulse/tests/trace-forensics-mapper.test.ts`
  - script: `pnpm --filter pulse test:trace-forensics-mapper`

### M8.5 — Deployment Detail Presenter Parity
- Current state: deployment detail route exists; full intelligence presenter parity remains partial.
- Pulse target: source-equivalent deployment detail behavior on existing route.
- Scope:
  1. Port remaining deployment intelligence blocks and correlated signal rendering.
  2. Preserve source contract usage and guard behavior.
  3. No net-new deployment workflows.

#### M8.5 Implementation Notes (2026-05-15)
- Added deployment detail read proxy:
  - `apps/pulse/app/api/deployments/[id]/detail/route.ts`
- Added deployment detail presenter mapper:
  - `apps/pulse/lib/deployment-detail-mapper.ts`
- Wired deployment detail route-mode presenter blocks in:
  - `apps/pulse/components/dashboard/content/deployments-content.tsx`
  - includes mapped deployment metadata, gate summary, risk pattern snippets, and linked incident/event counts.
- Added focused tests:
  - `apps/pulse/tests/deployment-detail-mapper.test.ts`
  - `apps/pulse/tests/deployment-detail-presenter-smoke.test.tsx`
  - scripts:
    - `pnpm --filter pulse test:deployment-detail-mapper`
    - `pnpm --filter pulse test:deployment-detail-presenter-smoke`

### M8.6 — Project Presenter Depth Parity
- Current state: required project routes exist; some views still use narrowed read presenters.
- Pulse target: close presenter-depth parity for project reliability/regressions/timeline views where source behavior is still reduced.
- Scope:
  1. Align project-scoped presenter depth with `apps/web` behavior.
  2. Keep current write boundaries and safety constraints unchanged.
  3. Avoid unrelated UI redesign.

## Cross-Slice Preconditions
1. Slice-level source-of-truth mapping in `apps/web` (route + presenter + API contract).
2. Explicit ownership decision for waived routes before implementation (onboarding/billing flows).
3. Auth redirect/return-path expectations documented for each affected route.
4. Rollback path documented per slice.

## Validation Gate
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Route presence in build output for affected routes
- Unauth probes for affected protected routes (return-path preserved)
- Manual functional pass for each migrated source behavior

## Acceptance Criteria (Per Slice)
- Source-equivalent behavior is implemented for the targeted deferred feature.
- No auth return-path regressions.
- Migration audit matrix updated from `Partial` to `Parity reached` for that feature row, or remaining gap is explicitly documented.
- Any newly deferred write/action behavior is added to the deferred register immediately.

## Out Of Scope (Unless Explicitly Approved)
- Phase 9 net-new expansion behavior
- Marketing/public routes (`/docs`, `/docs-marketing`, `/pricing`, `/signup`)
- UX redesign unrelated to source parity
