# Agent Migration Contract Rules

## Purpose
Mandatory migration contract reference for all agent-driven Pulse migration work.

## Mandatory Use
Required:
- for every `M7+` migration slice
- before parity acceptance for migrated routes
- before `Phase 9` unblock

## Contract Template (Required Per Route)

```md
Route: /projects/[projectId]/regressions
Source route: apps/web/...
Pulse route: apps/pulse/...
Data loader:
Presenter/component:
Project scoping preserved: yes/no
Auth preserved: yes/no
Write actions introduced: no
Legacy deep links remaining: yes/no
Known deltas:
Validation:
```

## Contract Entries

### M8.1 — Onboarding Ownership Transfer
Route: /onboarding
Source route: apps/web/app/(onboarding)/onboarding/page.tsx
Pulse route: apps/pulse/app/(app)/onboarding/page.tsx
Data loader: apps/pulse/lib/onboarding-data.ts
Presenter/component: apps/pulse/components/onboarding/onboarding-simulation-runner.tsx
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: no
Legacy deep links remaining: no
Known deltas: none material; source-style incident command handoff path is preserved via compatibility route.
Validation: pending (`pnpm --filter pulse lint`, `pnpm --filter pulse build`, route-map check, unauth return-path probe)

### M8.2 — Incident Detail Action Parity
Route: /incidents/[incidentId]
Source route: apps/web/app/(app)/incidents/[incidentId]/page.tsx
Pulse route: apps/pulse/app/(app)/incidents/[incidentId]/page.tsx
Data loader: apps/pulse/lib/incidents-data.ts
Presenter/component: apps/pulse/components/dashboard/content/incidents-content.tsx
Project scoping preserved: yes (org-scoped incident API contracts preserved)
Auth preserved: yes
Write actions introduced: yes (source-parity incident lifecycle actions only: acknowledge/resolve/reopen/assign owner)
Legacy deep links remaining: yes (`/incidents/[incidentId]/investigate` and `/compare` parity remains queued)
Known deltas: Pulse still uses dashboard presenter instead of source incident-detail presenter; action set is now parity-wired through Pulse API proxies.
Validation: passed (`pnpm --filter pulse lint`, `pnpm --filter pulse build`, build-map includes incident action API routes); unauth probe blocked locally because `localhost:3005` was not running in shell context.

### M8.3 — Audit Stage/Results Action Parity
Route: /audits/[id], /audits/[id]/results
Source route: apps/web/app/(app)/audits/[id]/page.tsx, apps/web/app/(app)/audits/[id]/results/page.tsx
Pulse route: apps/pulse/app/(app)/audits/[id]/page.tsx, apps/pulse/app/(app)/audits/[id]/results/page.tsx
Data loader: apps/pulse/lib/audits-data.ts + apps/pulse/app/api/audits/[id]/detail/route.ts
Presenter/component: apps/pulse/components/dashboard/content/audits-content.tsx
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: yes (source-parity audit run/stage actions only: new_run/start/continue/rerun)
Legacy deep links remaining: no
Known deltas: Pulse keeps dashboard-native presenter; results-table parity depth remains queued under later presenter-depth slice.
Validation: passed (`pnpm --filter pulse test:audit-action-parity`, `pnpm --filter pulse lint`, `pnpm --filter pulse build`)
