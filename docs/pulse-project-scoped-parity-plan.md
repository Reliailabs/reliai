# Pulse Project-Scoped Parity Plan (M5)

## Purpose
Define migration-only parity work for project-scoped operational routes from `apps/web` into `apps/pulse`.

## Scope Boundary
- Classification: `Migration`
- Net-new behavior: `No`
- Source of truth: `apps/web` business logic, route behavior, and API contracts
- UI references: existing Pulse surfaces only; no redesign

## Source Routes (apps/web)
- `/projects/[projectId]/control`
- `/projects/[projectId]/deployments`
- `/projects/[projectId]/guardrails`
- `/projects/[projectId]/ingestion`
- `/projects/[projectId]/metrics`
- `/projects/[projectId]/processors`
- `/projects/[projectId]/regressions`
- `/projects/[projectId]/reliability`
- `/projects/[projectId]/settings`
- `/projects/[projectId]/timeline`

## Target Strategy (apps/pulse)
Use route parity under app shell with context-mode injection into existing Pulse sections.

### Proposed target routes
- `/projects/[projectId]/control`
- `/projects/[projectId]/deployments`
- `/projects/[projectId]/guardrails`
- `/projects/[projectId]/metrics`
- `/projects/[projectId]/settings`
- `/projects/[projectId]/timeline`

### Deferred within M5 (explicitly)
- `/projects/[projectId]/ingestion`
- `/projects/[projectId]/processors`
- `/projects/[projectId]/regressions`
- `/projects/[projectId]/reliability`

These deferred routes stay `Partial` until dedicated parity slices.

## Route-to-Section Mapping (Phase 1)
- `control` -> `overview` + project context card
- `deployments` -> `deployments` section with project filter context
- `guardrails` -> `guardrails` section with project filter context
- `metrics` -> `metrics` section with project filter context
- `settings` -> `settings` section with project context
- `timeline` -> `overview` timeline panel with project filter context

## Data/Contract Rules
- Reuse existing API contracts from `apps/web/lib/api.ts` for project-scoped fetches.
- No schema changes.
- No endpoint behavior changes.
- Track per-source status (`ok | error`) and preserve empty-state correctness.

## Auth/Guard Rules
- Maintain existing app auth guard in `(app)` layout.
- Enforce project membership/org scoping before rendering project routes.
- Redirect unauthorized project access to safe app route with explanatory state.

## Slice Plan

### Slice M5.1 — Project Route Spine
- Add route files for target routes above.
- Add project route context type and shell plumbing.
- No new presenter components.

### Slice M5.2 — Project Control Parity
- Inject project-aware data into existing overview surface.
- Add compact parity notice where full presenter parity is pending.

### Slice M5.3 — Project Deployments/Guardrails/Metrics Parity
- Route-level project context injection only.
- Keep existing section visuals.

### Slice M5.4 — Project Settings/Timeline Parity
- Route-level project context injection only.
- Preserve current settings IA.

## Validation Gate (each slice)
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
  - Signed-in project member can open each mapped route.
  - Non-member is blocked gracefully.
  - Empty/error states remain accurate.

## Explicit Non-Goals
- No project IA redesign
- No new project APIs
- No execution/automation features
- No Phase 9 expansion

## Completion Criteria
- All non-deferred M5 routes exist and resolve under auth.
- Route context is wired and deterministic.
- Migration audit sheet rows for project-scoped routes updated from `Not started` to `Partial` or `Parity reached` per route.
