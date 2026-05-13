# Pulse M7 — Deferred Project Routes Parity Audit

Date: 2026-05-13

## Gate
- Classification: `Migration`
- Net-new behavior: `No`
- Source-of-truth checked: `apps/web`
- Pulse parity status: `Parity reached` (required deferred routes implemented)
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
| `/projects/[projectId]/ingestion` | Present | Present | M7.4 route wired | Route resolves in Pulse with project-scoped ingestion visibility and policy update actions for sampling/retention/cardinality. |
| `/projects/[projectId]/processors` | Present | Present | M7.5 route wired | Route resolves in Pulse with project-scoped processor inventory plus create/edit/enable/disable actions. |
| `/projects/[projectId]/regressions` | Present | Present | M7.2 route wired | Route resolves in Pulse with project-scoped regressions behavior required by M7 route-parity gate. |
| `/projects/[projectId]/reliability` | Present | Present | M7.1 route wired | Route resolves in Pulse with project-scoped reliability behavior required by M7 route-parity gate. |
| `/projects/[projectId]/settings` | Present | Present | M7.6 route wired | Route resolves in Pulse with project profile/metadata visibility and profile update actions (`name`, `slug`, `description`). |
| `/projects/[projectId]/timeline` | Present | Present | M7.3 route wired | Route now resolves in Pulse with read-only project timeline feed (incidents/regressions/deployments/guardrails) and project-scoped backend timeline API wiring. |

## Route-Order Recommendation (execution)
1. `/projects/[projectId]/reliability`
2. `/projects/[projectId]/regressions`
3. `/projects/[projectId]/timeline`
4. `/projects/[projectId]/ingestion`
5. `/projects/[projectId]/processors`
6. `/projects/[projectId]/settings`
7. `/playground`
8. Conditional ownership decision doc for `/settings/billing`, `/billing/success`, `/onboarding`
9. Strengthen Pulse lint gate coverage

## Constraints
- Route/context migration first.
- Logic/contracts parity before presenter parity.
- No project automation or command execution behavior.
- No Phase 9 expansion work in these slices.

## Decision
M7 route-parity gate is complete.

## Conditional Ownership (M7.8)
- Explicit conditional-ownership decision record: `docs/pulse-m7-8-conditional-ownership-decision.md`
- Routes covered: `/settings/billing`, `/billing/success`, `/onboarding`
- Status: explicitly retained in `apps/web` for current migration scope (waived from Pulse gate).

## Tracking Caveat (Must Resolve Before Readiness)
- Existing auth return-path behavior redirects unauthenticated project deep links with `return_to=/pulse` instead of the requested route.
- This was not introduced by M7.1/M7.2, but it is a migration-readiness bug if deep-link auth return paths are required.
- Must be resolved or explicitly accepted before declaring migration readiness.

## M7.x Auth Return-Path Preservation (Resolved)
- Implemented as a separate migration-readiness slice to avoid conflating with route-parity completion.
- `apps/pulse/proxy.ts` now protects `/projects/:path*` and preserves full deep-link return paths on auth redirect.
- Regression probes now pass:
  - `/projects/abc/reliability` -> `return_to=/projects/abc/reliability`
  - `/projects/abc/regressions` -> `return_to=/projects/abc/regressions`
  - `/settings` -> `return_to=/settings`
  - `/pulse` -> `return_to=/pulse`

## Deferred Write-Parity Register (Queued Follow-Ups)
- This register tracks write flows that were intentionally deferred, skipped, or narrowed during migration slices.
- Migration readiness cannot be declared complete while any required write-parity item remains open unless explicitly waived.

### M7.4b — Ingestion Write Parity
- Route: `/projects/[projectId]/ingestion`
- Current Pulse state: write parity implemented
- Source parity expectation (`apps/web`): update ingestion policy values
- Required write scope: update sampling, retention, and cardinality caps

### M7.5b — Processors Write Parity
- Route: `/projects/[projectId]/processors`
- Current Pulse state: write parity implemented
- Source parity expectation (`apps/web`): create/edit/enable/disable processors
- Required write scope: create processor, update processor, enable/disable processor

### M7.6b — Project Settings Write Parity
- Route: `/projects/[projectId]/settings`
- Current Pulse state: write parity implemented
- Source parity expectation (`apps/web`): project settings read/write behavior
- Required write scope: update project name, slug, description via source contracts

### Validation Rule (Applies to Every Deferred Write Slice)
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- targeted manual checks for affected write flows
- unauth deep-link return-path probe for the route under change

## M7.9 Lint Gate Hardening (Completed)
- Pulse lint script now runs full-app coverage (`eslint .`) instead of a narrow file subset.
- Added lint ignores for build/runtime artifacts and excluded `components/marketing-linear/**` from migration gate scope to avoid non-app marketing noise.
- Result: lint gate is broader and passing with warnings; warning cleanup remains separate from migration route parity.
