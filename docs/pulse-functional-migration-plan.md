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
