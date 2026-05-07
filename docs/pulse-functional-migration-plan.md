# Pulse Functional Migration Plan (No Blind Overwrites)

## Locked Constraints
- No dashboard styling changes.
- No marketing styling changes.
- Keep `apps/pulse/components/marketing-linear/**` styling intact.
- Functional edits in marketing are allowed for routing/content wiring only.
- Migrate core app functionality into `apps/pulse/app/(app)/**`; marketing functional wiring is permitted where needed.
- No template overwrite, no bulk copy, no visual redesign.
- Branch discipline: create a new branch for every new migration scope/slice; do not reuse completed slice branches.

## Deferred Capabilities (Not Included in Functional Migration)
The following capabilities are intentionally deferred to later architecture passes and are not part of the current functional migration effort.

### Traces
- trace replay redesign
- compare-mode rewrites
- graphing engine changes
- provider abstraction layers
- eval correlation logic
- causality graphing

### Incidents / Errors
- incident automation workflows
- remediation orchestration
- advanced escalation logic
- AI-generated RCA flows

### Deployments
- deployment causality analysis
- rollback orchestration
- deployment risk scoring

### Audits / Governance
- certification workflows
- compliance exports
- governance automation

### Platform-wide
- visual redesign
- design-system rewrites
- API contract redesign
- backend schema rewrites
- cross-service normalization
- advanced realtime/event architecture

## Phase 0 — Safety Setup
1. Create migration branch.
2. Confirm current `apps/pulse` build baseline.
3. Lock protected styling paths:
   - `apps/pulse/app/(marketing)/**` (style/layout/tokens/motion only)
   - `apps/pulse/components/marketing-linear/**` (style/layout/tokens/motion only)
   - dashboard styling files
   - marketing styling files
4. Enforce forbidden actions listed above throughout migration.
5. Allow marketing functional wiring edits:
   - nav/menu/login link targets
   - CTA route destinations
   - non-visual route plumbing

## Phase 1 — Inventory + Mapping
1. Build functional mapping from:
   - `app/dashboard-v1`
   - `apps/web`
   - `apps/web-v2`
2. Create route/component matrix with:
   - source file
   - target file
   - keep/adapt/replace
   - dependencies
   - risk notes

## Phase 2 — Core Shell + Auth Wiring
1. Wire `(app)` session guard and app shell behavior.
2. Wire sign-in/sign-out/session fetch paths.
3. Keep `/pulse` functional and protected.
4. Validate with lint/build.

## Phase 3 — Functional Route Migration (Service-Anchored Order)
1. `/pulse`
2. `/services`
3. `/incidents`
4. `/errors`
5. `/traces`
6. `/deployments`
7. `/audits`
8. `/guardrails`
9. `/metrics`
10. `/on-call`
11. `/postmortems`
12. `/settings`

All route work is functional-only, no style edits.

## Phase 4 — Operational Primitives Wiring
1. Domain model alignment:
   - Organization -> Project -> Service -> Environment -> Signal/Event -> Incident/Postmortem
2. SLA model:
   - API uptime
   - trace ingestion uptime
   - eval pass-rate uptime
   - safe completion SLA
   - agent task success SLA
   - error budget
   - reliability score history
3. AI-native error model:
   - prompt errors
   - tool-call failures
   - retrieval failures
   - guardrail violations
   - eval failures
   - agent loop failures
   - schema/output failures
   - provider/model errors
4. On-call primitives:
   - escalation policy
   - owner/team assignment
   - severity routing
   - acknowledge/resolve workflow
   - incident timeline entries
5. Postmortem structure:
   - summary, impact, root cause, detection, timeline
   - what went well / what failed
   - corrective actions
   - linked traces/deployments/evals
   - owner + due date

## Phase 5 — Validation + Gap Report
1. Run:
   - `pnpm --filter pulse lint`
   - `pnpm --filter pulse build`
2. Manual smoke pass over migrated routes.
3. Deliver:
   - migrated functionality list
   - unresolved gaps
   - next migration slice

## Phase 6 — Functional Parity Pass (Post Route Spine)
Goal: make `apps/pulse` behaviorally equivalent to the source app surfaces without visual redesign.

### Scope
- Route-level functional parity only (no style/layout/motion changes).
- Reuse existing data contracts and auth behavior from `apps/web` as source of truth.
- Preserve stable identifiers and route semantics already introduced in prior slices.

### Order
1. `/errors` parity:
   - align AI-native error categories/signals
   - ensure stable event/error IDs in list/detail
   - wire route-local loading/empty/error states
2. `/traces` parity:
   - align trace list/detail primitives
   - preserve stable trace IDs and deep-link behavior
3. `/deployments` parity:
   - align release/deployment event primitives
   - support reliability-correlation labels where already available
4. `/audits` parity:
   - align audit status/run primitives used by Pulse summaries
5. Cross-route linkage pass:
   - errors -> incidents (reference-level only)
   - traces -> incidents/deployments (reference-level only)
   - audits -> reliability posture surfaces

### Exclusions
- No backend schema redesign.
- No new provider adapters.
- No remediation workflow expansion.
- No postmortem authoring workflows.
- No visual redesign of dashboard or marketing surfaces.

### Functional Parity Checklist
- Data contracts match existing `apps/web` behavior for each migrated route.
- Route-local loading/empty/error states are explicit and non-generic.
- Stable IDs are displayed/used for routing and references.
- No protected styling boundaries are modified.
- Route remains auth-protected and respects sign-in return flow.

### Validation Gate
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Targeted manual smoke for each parity route:
  - signed-out redirect behavior
  - signed-in route load
  - empty/loading/error state correctness
  - expected reference/deep-link behavior

## Slice 1 Mapping — Core Shell/Auth + /pulse

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Auth/Session Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/layout.tsx` | `app/dashboard-v1/app/(app)/layout.tsx` + `apps/web` auth contract | Adapt | No | No | Requires valid operator session; redirects unauthenticated users to `/sign-in?return_to=<path>` | `/pulse` and future `(app)` routes |
| `apps/pulse/app/sign-in/page.tsx` | `app/dashboard-v1/app/sign-in/page.tsx` + `apps/web` auth behavior | Adapt | No | No | If session exists, redirect to sanitized `return_to` (default `/pulse`); submit to local auth route | `/pulse`, `(app)` shell |
| `apps/pulse/lib/auth.ts` | `app/dashboard-v1/lib/auth.ts` + `apps/web` contract alignment | Adapt | No | No | Session lookup, token/cookie resolution, require-session helper, safe redirect utilities | `(app)/layout`, `sign-in` |
| `apps/pulse/lib/constants.ts` | `app/dashboard-v1/lib/constants.ts` + `apps/web` env contract | Adapt | No | No | Centralized API URL + session cookie key used by auth helpers/routes | `lib/auth.ts`, auth routes |
| `apps/pulse/app/api/auth/dev-sign-in/route.ts` | `apps/web`/`dashboard-v1` existing contract | Adapt | No | No | Creates session cookie using existing API auth endpoint contract; preserves `return_to` redirect | `sign-in` |
| `apps/pulse/app/api/auth/sign-out/route.ts` | `apps/web`/`dashboard-v1` | Adapt | No | No | Clears session cookie and redirects to sign-in | app shell/logout actions |
| `apps/pulse/app/(app)/pulse/page.tsx` | current `apps/pulse` + `dashboard-v1` protection expectations | Keep (functional check) | No | No | No new auth logic; relies on `(app)` guard to guarantee authenticated context | `(app)/layout` |
| `apps/pulse/app/(app)/loading.tsx` and `apps/pulse/app/(app)/error.tsx` | `dashboard-v1` | Adapt | No | No | Predictable loading/error fallback behavior for protected app shell | `(app)` routes |

### Slice 1 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
  - signed-out user visiting `/pulse` redirects to sign-in
  - sign-in returns to `/pulse`
  - signed-in user can load `/pulse`
  - marketing routes remain unchanged (`/`, `/demo`)
  - protected paths untouched

## Boundary Update (Marketing)

Effective rule update:
- Marketing boundary is **style-only**.
- Marketing functional/routing updates are allowed, provided no styling/layout/motion changes are introduced.

Examples allowed:
- wiring `Sign in` nav link to `/sign-in`
- wiring menu links to real routes
- updating CTA destinations

Examples disallowed:
- className/style/token/theme changes
- layout structure changes
- animation/motion redesign

## Slice 2 Mapping — `/services` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing `apps/pulse/app/(app)/pulse/page.tsx` composition | Adapt (extract shared shell) | No | No | Shared app-shell composition for dashboard sections via `initialSection` | `AppSidebar`, `MainContent`, `RightPanel` |
| `apps/pulse/app/(app)/pulse/page.tsx` | existing `apps/pulse` pulse route | Adapt (use shared shell) | No | No | Maintains pulse landing behavior by rendering shell with `initialSection="overview"` | `(app)` auth guard, `dashboard-shell` |
| `apps/pulse/app/(app)/services/page.tsx` | phase plan route list + existing dashboard section model | Add | No | No | Adds authenticated `/services` route using shell with `initialSection="systems"` | `(app)` auth guard, `dashboard-shell` |

### Slice 2 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
  - signed-in `/services` loads successfully
- signed-out `/services` redirects to sign-in through existing `(app)` guard
- `/pulse` behavior remains unchanged
- no marketing style files changed

## Slice 3 Mapping — `/incidents` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/incidents/page.tsx` | phase plan route order + existing `MainContent` section support | Add | No | No | Adds authenticated `/incidents` route that opens dashboard shell with `initialSection="incidents"` | `(app)` auth guard, `dashboard-shell`, `IncidentsContent` |

### Slice 3 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
  - signed-in `/incidents` loads incident section
- signed-out `/incidents` redirects through existing `(app)` sign-in flow
- `/pulse` and `/services` remain unchanged

## Slice 4 Mapping — `/errors` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/errors/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/errors` route that opens dashboard shell with `initialSection="errors"` | `(app)` auth guard, `dashboard-shell`, `ErrorsContent` |

### Slice 4 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/errors` loads error-tracking section
- signed-out `/errors` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, and `/incidents` remain unchanged

## Slice 5 Mapping — `/traces` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/traces/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/traces` route that opens dashboard shell with `initialSection="traces"` | `(app)` auth guard, `dashboard-shell`, traces section content |

### Slice 5 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/traces` loads trace surface
- signed-out `/traces` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, and `/errors` remain unchanged

## Slice 6 Mapping — `/deployments` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/deployments/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/deployments` route that opens dashboard shell with `initialSection="deployments"` | `(app)` auth guard, `dashboard-shell`, deployments section content |

### Slice 6 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/deployments` loads deployment surface
- signed-out `/deployments` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, and `/traces` remain unchanged

## Slice 7 Mapping — `/audits` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/audits/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/audits` route that opens dashboard shell with `initialSection="audits"` | `(app)` auth guard, `dashboard-shell`, audits section content |

### Slice 7 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/audits` loads audits surface
- signed-out `/audits` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, `/traces`, and `/deployments` remain unchanged

## Slice 8 Mapping — `/guardrails` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/guardrails/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/guardrails` route that opens dashboard shell with `initialSection="guardrails"` | `(app)` auth guard, `dashboard-shell`, guardrails section content |

### Slice 8 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/guardrails` loads guardrails surface
- signed-out `/guardrails` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, `/traces`, `/deployments`, and `/audits` remain unchanged

## Slice 9 Mapping — `/metrics` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/metrics/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/metrics` route that opens dashboard shell with `initialSection="metrics"` | `(app)` auth guard, `dashboard-shell`, metrics section content |

### Slice 9 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/metrics` loads metrics surface
- signed-out `/metrics` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, `/traces`, `/deployments`, `/audits`, and `/guardrails` remain unchanged

## Slice 10 Mapping — `/on-call` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/on-call/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/on-call` route that opens dashboard shell with `initialSection="oncall"` | `(app)` auth guard, `dashboard-shell`, on-call section content |

### Slice 10 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/on-call` loads on-call surface
- signed-out `/on-call` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, `/traces`, `/deployments`, `/audits`, `/guardrails`, and `/metrics` remain unchanged

## Slice 11 Mapping — `/postmortems` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/postmortems/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/postmortems` route that opens dashboard shell with `initialSection="postmortems"` | `(app)` auth guard, `dashboard-shell`, postmortems section content |

### Slice 11 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/postmortems` loads postmortems surface
- signed-out `/postmortems` redirects through existing `(app)` sign-in flow
- `/pulse`, `/services`, `/incidents`, `/errors`, `/traces`, `/deployments`, `/audits`, `/guardrails`, `/metrics`, and `/on-call` remain unchanged

## Slice 12 Mapping — `/settings` Route (Functional-Only)

### File Mapping Matrix

| Target File | Source of Truth | Action | Styling Impact | Protected Boundary Touch | Behavior Introduced | Depends On |
|---|---|---|---|---|---|---|
| `apps/pulse/app/(app)/settings/page.tsx` | phase plan route order + existing dashboard section model | Add | No | No | Adds authenticated `/settings` route that opens dashboard shell with `initialSection="settings"` | `(app)` auth guard, `dashboard-shell`, settings section content |
| `apps/pulse/components/dashboard/content/settings-content.tsx` | current pulse settings content + migration IA guardrails | Adapt (minimal) | No | No | Prioritizes `Appearance`, `Integrations`, and `Security` in quick settings list | `/settings` section rendering |

### Slice 12 Validation Checklist

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
- signed-in `/settings` loads settings surface
- signed-out `/settings` redirects through existing `(app)` sign-in flow
- quick settings order prioritizes Appearance -> Integrations -> Security
- all prior migrated routes remain unchanged

## Auth Hardening — Return-To Preservation

### Objective
- Preserve the exact requested protected route in sign-in redirect flow instead of defaulting all unauthenticated traffic to `/pulse`.

### Implementation
- Add `apps/pulse/proxy.ts` to enforce auth for protected app routes.
- Redirect unauthenticated or invalid-session requests to:
  - `/sign-in?return_to=<requested_path_and_query>`
- Keep server-side layout guard in place as defense-in-depth.
- Update `requireOperatorSession` to derive return target from request headers when explicit route is not provided.

### Validation Checklist
- signed-out request to `/traces` redirects to `/sign-in?return_to=%2Ftraces`
- signed-out request to `/settings` redirects to `/sign-in?return_to=%2Fsettings`
- successful sign-in returns user to original requested route
- authenticated access to protected routes remains unchanged

### Redirect Matrix (Verified)
| Request | Expected | Observed |
|---|---|---|
| `/incidents?x=1` (no session) | 307 -> `/sign-in?return_to=%2Fincidents%3Fx%3D1` | matched |
| `/traces` (no session) | 307 -> `/sign-in?return_to=%2Ftraces` | matched |
| `/settings` (no session) | 307 -> `/sign-in?return_to=%2Fsettings` | matched |
| `/on-call` (no session) | 307 -> `/sign-in?return_to=%2Fon-call` | matched |
| `/traces` with invalid `reliai_session` | 307 -> `/sign-in?return_to=%2Ftraces` | matched |

## Parity Slice 1 — `/pulse` Functional Wiring (Template-Preserving)

### Scope
- Keep existing `apps/pulse` dashboard visual shell and template components.
- Add logic/data helpers for `/pulse` and inject computed values into existing cards/panels.
- No full presenter/page replacement from `dashboard-v1`.

### File Mapping Matrix
| Target File | Source of Truth | Action | Notes |
|---|---|---|---|
| `apps/pulse/app/(app)/pulse/page.tsx` | current pulse route + dashboard-v1 data behavior | Adapt | Server-side live/demo selection and data fetch wiring |
| `apps/pulse/lib/pulse-data.ts` | dashboard-v1 fetch and decision patterns | Add | Safe source fetches, demo isolation, compact AREI scoring, overview model |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing pulse shell | Adapt | Pass optional overview data to existing content/panel components |
| `apps/pulse/components/dashboard/main-content.tsx` | existing pulse shell | Adapt | Inject overview data only when `activeSection` is `overview` |
| `apps/pulse/components/dashboard/content/overview-content.tsx` | existing pulse template overview | Adapt | Replace static counters/lists with computed values; add compact source-error notice |
| `apps/pulse/components/dashboard/right-panel.tsx` | existing pulse template right panel | Adapt | Map AREI and recent activity to computed data without layout changes |
| `apps/pulse/components/dashboard/pulse-types.ts` | local pulse route needs | Add | Local typed view model for overview wiring |

### Validation
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Manual smoke:
  - `/pulse?demo=1` uses demo-only snapshot
  - `/pulse` uses live API-backed data
  - source failures show compact unavailable notice in existing panel slots

## Parity Slice 2 — `/services` Functional Wiring (Template-Preserving)

### Scope
- Keep existing `apps/pulse` services visual surface intact.
- Add services data helper and inject computed values into existing cards/summary.
- No presenter swap, no style/layout changes.

### File Mapping Matrix
| Target File | Source of Truth | Action | Notes |
|---|---|---|---|
| `apps/pulse/app/(app)/services/page.tsx` | existing route + parity pattern from pulse slice | Adapt | Server-side services data fetch and shell data injection |
| `apps/pulse/lib/services-data.ts` | existing `apps/web` project/reliability endpoints | Add | API-backed services model, derived status/uptime/latency, safe source error reporting |
| `apps/pulse/components/dashboard/pulse-types.ts` | local pulse types | Adapt | Add `ServicesSurfaceData` and service card model |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing shell | Adapt | Pass optional services data to main content |
| `apps/pulse/components/dashboard/main-content.tsx` | existing section switch | Adapt | Inject services data into existing services content component |
| `apps/pulse/components/dashboard/content/services-content.tsx` | existing template component | Adapt | Replace static data with injected values; add compact source-error notice |

### Intentional Gaps
- No incident coupling or remediation flows in services cards.
- No deployment causality or deep-link graphing yet.
- No provider-specific adapter or schema changes.

## Parity Slice 3 — `/incidents` Functional Wiring (Template-Preserving)

### Scope
- Keep existing incidents layout and interaction model.
- Inject API-backed incidents data and normalized status/timeline values.
- Add route-local source error and empty-state handling in existing section slots.

### File Mapping Matrix
| Target File | Source of Truth | Action | Notes |
|---|---|---|---|
| `apps/pulse/app/(app)/incidents/page.tsx` | existing route + parity pattern | Adapt | Server fetch/injection for incidents surface |
| `apps/pulse/lib/incidents-data.ts` | existing incidents endpoints | Add | Fetch/normalize incidents + events into surface model |
| `apps/pulse/components/dashboard/pulse-types.ts` | local view-model layer | Adapt | Add `IncidentsSurfaceData` model |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing shell | Adapt | Pass incidents data through shell |
| `apps/pulse/components/dashboard/main-content.tsx` | existing section switch | Adapt | Inject incidents data into existing content component |
| `apps/pulse/components/dashboard/content/incidents-content.tsx` | existing template component | Adapt | Use injected data, preserve UI hierarchy, add compact unavailable + empty states |

### Intentional Gaps
- No RCA workflow implementation.
- No escalation orchestration or on-call policy logic.
- No postmortem coupling or deployment-causality overlay.
- No trace replay embedding inside incidents surface.

## Parity Slice 4 — `/errors` Functional Wiring (Template-Preserving)

### Scope
- Keep existing errors visual hierarchy and charts layout.
- Inject API-backed error signal data via route-level server wiring.
- Add compact source-unavailable notice and existing-slot empty state.

### File Mapping Matrix
| Target File | Source of Truth | Action | Notes |
|---|---|---|---|
| `apps/pulse/app/(app)/errors/page.tsx` | existing route + parity pattern | Adapt | Server-side fetch/injection for errors surface data |
| `apps/pulse/lib/errors-data.ts` | existing traces/incidents/projects/regressions endpoints | Add | Fetch/normalize errors signal model, safe defaults, source-error reporting |
| `apps/pulse/components/dashboard/pulse-types.ts` | local view-model layer | Adapt | Add `ErrorsSurfaceData` contracts |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing shell | Adapt | Pass optional errors data through shell |
| `apps/pulse/components/dashboard/main-content.tsx` | existing section switch | Adapt | Inject errors data into existing errors content |
| `apps/pulse/components/dashboard/content/errors-content.tsx` | existing template component | Adapt | Bind metrics/trend/funnel/top-errors to injected data; add compact unavailable + empty state |

### Intentional Gaps
- No incident creation workflows from errors.
- No trace replay/deep-link expansion beyond current slots.
- No remediation orchestration.
- No provider adapter redesign or severity model redesign.

## Parity Slice 5 — `/traces` Functional Wiring (Template-Preserving)

### Scope
- Keep existing traces/performance surface and chart/table layout.
- Inject API-backed traces evidence data via route-level server wiring.
- Add compact source-unavailable notice and trace empty-state message in existing content slot.

### File Mapping Matrix
| Target File | Source of Truth | Action | Notes |
|---|---|---|---|
| `apps/pulse/app/(app)/traces/page.tsx` | existing route + parity pattern | Adapt | Server-side fetch/injection for traces surface data |
| `apps/pulse/lib/traces-data.ts` | existing traces/projects endpoints | Add | Fetch/normalize trace latency/throughput/service-latency models with safe defaults |
| `apps/pulse/components/dashboard/pulse-types.ts` | local view-model layer | Adapt | Add `TracesSurfaceData` contracts |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | existing shell | Adapt | Pass optional traces data through shell |
| `apps/pulse/components/dashboard/main-content.tsx` | existing section switch | Adapt | Inject traces data into existing traces/performance content |
| `apps/pulse/components/dashboard/content/performance-content.tsx` | existing template component | Adapt | Bind charts/metrics/table to injected data; add compact unavailable + empty state |

### Intentional Gaps
- No trace replay redesign.
- No compare-mode rewrite.
- No graph engine or causality graphing changes.
- No eval-correlation or provider abstraction redesign.

## Settings Mapping Matrix

| Setting | State | Current route | Dependency | Target phase | Role gating |
|---|---|---|---|---|---|
| Appearance | Mapped | `/settings#appearance` | Existing UI preference model | Now | User |
| Integrations | Mapped | `/settings#integrations` | Existing integration config | Now | Admin/Owner |
| Security | Mapped | `/settings#security` | Existing auth/session policy | Now | Admin/Owner |
| Organization | Partial | `/settings#organization` | Tenant/org profile model | Next | Admin/Owner |
| Members | Partial | `/settings#members` | Membership + role model | Next | Admin/Owner |
| Projects | Stub | `/settings#projects` | Project config model | Later | Admin/Owner |
| Services / Systems | Stub | `/settings#services` | Service ownership + environment model | Later | Admin/Owner |
| Alerts | Stub | `/settings#alerts` | Alert rule model + escalation policy | Later | Admin/Owner |
| Notifications | Stub | `/settings#notifications` | User delivery preference model | Later | User |
| System Admin | Stub | `/settings/system` | Elevated operator role + admin APIs | Last | System admin only |

### Settings Stub Rule
- Settings entries should not be removed simply because they are not wired yet.
- Non-ready entries must route to a clear planned/partial state rather than becoming dead links.
