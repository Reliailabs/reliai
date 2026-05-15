# Agent Migration Contract Rules

## Purpose
Mandatory migration contract reference for all agent-driven Pulse migration work.

## Mandatory Use
Required:
- for every `M7+` migration slice
- before parity acceptance for migrated routes
- before `Phase 9` unblock

## Proxy Route Exception Policy
Default:
- proxy routes are required for client/API action parity slices

Allowed exception:
- server-side read presenters may use direct source-contract loaders without a proxy route
- the exception is valid only when mapper tests and presenter/surface tests cover the route contract

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

### M8.4 — Trace Forensics Presenter Parity
Route: /traces/[traceId], /traces/[traceId]/compare, /traces/[traceId]/graph
Source route: apps/web/app/(app)/traces/[traceId]/page.tsx, apps/web/app/(app)/traces/[traceId]/compare/page.tsx, apps/web/app/(app)/traces/[traceId]/graph/page.tsx
Pulse route: apps/pulse/app/(app)/traces/[traceId]/page.tsx, apps/pulse/app/(app)/traces/[traceId]/compare/page.tsx, apps/pulse/app/(app)/traces/[traceId]/graph/page.tsx
Data loader: apps/pulse/lib/traces-data.ts + apps/pulse/app/api/traces/[id]/forensics/route.ts
Presenter/component: apps/pulse/components/dashboard/content/performance-content.tsx
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: no
Legacy deep links remaining: no
Known deltas: Pulse keeps dashboard-native presenter structure while porting web-equivalent forensic capability (detail metadata, key findings, compare summary, graph summary) through existing contracts.
Validation: passed (`pnpm --filter pulse test:trace-forensics-mapper`, `pnpm --filter pulse lint`, `pnpm --filter pulse build`)

### M8.5 — Deployment Detail Presenter Parity
Route: /deployments/[deploymentId]
Source route: apps/web/app/(app)/deployments/[deploymentId]/page.tsx
Pulse route: apps/pulse/app/(app)/deployments/[deploymentId]/page.tsx
Data loader: apps/pulse/lib/deployments-data.ts + apps/pulse/app/api/deployments/[id]/detail/route.ts
Presenter/component: apps/pulse/components/dashboard/content/deployments-content.tsx
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: no
Legacy deep links remaining: no
Known deltas: Pulse keeps dashboard-native presenter structure while porting source-equivalent deployment detail capability through mapped read contracts (metadata/gate/risk patterns/correlation counts).
Validation: passed (`pnpm --filter pulse test:deployment-detail-mapper`, `pnpm --filter pulse test:deployment-detail-presenter-smoke`, `pnpm --filter pulse lint`, `pnpm --filter pulse build`)

### M8.6 — Project Presenter Depth Parity
Route: /projects/[projectId]/reliability, /projects/[projectId]/regressions, /projects/[projectId]/timeline
Source route: apps/web/app/(app)/projects/[projectId]/reliability/page.tsx, apps/web/app/(app)/projects/[projectId]/regressions/page.tsx, apps/web/app/(app)/projects/[projectId]/timeline/page.tsx
Pulse route: apps/pulse/app/(app)/projects/[projectId]/reliability/page.tsx, apps/pulse/app/(app)/projects/[projectId]/regressions/page.tsx, apps/pulse/app/(app)/projects/[projectId]/timeline/page.tsx
Data loader: apps/pulse/lib/project-reliability-surface.ts, apps/pulse/lib/project-reliability-mapper.ts, apps/pulse/lib/regressions-data.ts, apps/pulse/lib/regression-list-mapper.ts, apps/pulse/lib/project-timeline-data.ts
Presenter/component: project route pages under apps/pulse/app/(app)/projects/[projectId]/*
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: no
Legacy deep links remaining: no
Known deltas: Pulse stays read-only and dashboard-native, but closes narrowed presenter gaps by rendering source-contract reliability signals and richer regression context.
Validation: passed (`pnpm --filter pulse test:project-reliability-surface`, `pnpm --filter pulse test:regressions-data-mapper`, `pnpm --filter pulse lint`, `pnpm --filter pulse build`)
