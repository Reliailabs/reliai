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
Pulse route: apps/pulse/app/onboarding/page.tsx
Data loader: apps/pulse/lib/onboarding-data.ts
Presenter/component: apps/pulse/components/onboarding/onboarding-simulation-runner.tsx
Project scoping preserved: yes
Auth preserved: yes
Write actions introduced: no
Legacy deep links remaining: no
Known deltas: none material; source-style incident command handoff path is preserved via compatibility route.
Validation: pending (`pnpm --filter pulse lint`, `pnpm --filter pulse build`, route-map check, unauth return-path probe)
