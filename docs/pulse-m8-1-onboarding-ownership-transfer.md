# Pulse M8 — Deferred Migration Features Backlog

Date: 2026-05-13
Status: In progress (`M8.1` implemented, validation pending)
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

### M8.3 — Audit Stage/Results Action Parity
- Current state: audits routes are present; full stage-action/results presenter parity remains partial.
- Pulse target: source-equivalent audit action/results behavior on existing routes.
- Scope:
  1. Port missing audit stage actions from source route behavior.
  2. Ensure results/detail data shape parity.
  3. Preserve auth/project scoping and non-destructive defaults.

### M8.4 — Trace Forensics Presenter Parity
- Current state: trace detail/compare/graph routes exist; full forensic presenter behavior remains partial.
- Pulse target: source-equivalent trace deep-dive behavior on existing routes.
- Scope:
  1. Port missing compare/graph/detail presenter logic and data mappings.
  2. Preserve incident/deployment linkage semantics.
  3. No new trace feature expansion.

### M8.5 — Deployment Detail Presenter Parity
- Current state: deployment detail route exists; full intelligence presenter parity remains partial.
- Pulse target: source-equivalent deployment detail behavior on existing route.
- Scope:
  1. Port remaining deployment intelligence blocks and correlated signal rendering.
  2. Preserve source contract usage and guard behavior.
  3. No net-new deployment workflows.

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
