# Pulse M7 — Deferred Project Routes Parity Audit

Date: 2026-05-10

## Gate
- Classification: `Migration`
- Net-new behavior: `No`
- Source-of-truth checked: `apps/web`
- Pulse parity status: `Partial` (deferred routes not yet implemented)
- Phase 9 impact: `Blocked` until migration completion gate passes

## Deferred Routes Audited
- `/projects/[projectId]/ingestion`
- `/projects/[projectId]/processors`
- `/projects/[projectId]/regressions`
- `/projects/[projectId]/reliability`
- `/projects/[projectId]/settings`
- `/projects/[projectId]/timeline`

## Source Presence vs Pulse Presence

| Route | Source (`apps/web`) | Pulse (`apps/pulse`) | Status | Notes |
|---|---|---|---|---|
| `/projects/[projectId]/ingestion` | Present | Missing | Deferred / Not started | Requires ingestion policy presenter parity mapping. |
| `/projects/[projectId]/processors` | Present | Missing | Deferred / Not started | Requires processor extension/project processor parity mapping. |
| `/projects/[projectId]/regressions` | Present | Missing | Deferred / Not started | Requires regression investigation presenter parity mapping. |
| `/projects/[projectId]/reliability` | Present | Missing | Deferred / Not started | Requires project reliability dashboard presenter parity mapping. |
| `/projects/[projectId]/settings` | Present | Missing | Deferred / Not started | Requires project settings presenter parity mapping. |
| `/projects/[projectId]/timeline` | Present | Missing | Deferred / Not started | Requires project timeline presenter parity mapping. |

## Route-Order Recommendation (execution)
1. `/projects/[projectId]/reliability`
2. `/projects/[projectId]/regressions`
3. `/projects/[projectId]/timeline`
4. `/projects/[projectId]/ingestion`
5. `/projects/[projectId]/processors`
6. `/projects/[projectId]/settings`

## Constraints
- Route/context migration first.
- Logic/contracts parity before presenter parity.
- No project automation or command execution behavior.
- No Phase 9 expansion work in these slices.

## Decision
M7 remains deferred and blocked for implementation slices only under migration gate discipline.
