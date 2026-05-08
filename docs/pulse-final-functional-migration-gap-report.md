# Pulse Final Functional Migration Gap Report

Date: 2026-05-07
Branch: docs/pulse-final-migration-stabilization

## 1) Route Parity Status

### Core operator routes
- `/pulse` — wired (live/demo aware)
- `/services` — wired
- `/incidents` — wired
- `/errors` — wired
- `/traces` — wired
- `/deployments` — wired
- `/audits` — wired
- `/guardrails` — wired
- `/metrics` — wired
- `/on-call` — wired
- `/postmortems` — wired
- `/settings` — wired

### System admin routes (canonical)
- `/pulse/system` — wired
- `/pulse/system/platform` — wired
- `/pulse/system/pipeline` — wired
- `/pulse/system/extensions` — wired
- `/pulse/system/customers` — wired
- `/pulse/system/growth` — wired
- `/pulse/system/expansion` — wired
- `/pulse/system/reliability-patterns` — wired
- `/pulse/system/intelligence` — wired

## 2) Auth and Redirect Matrix

### Enforced behavior
- Any `(app)` route without valid session redirects to `/sign-in?return_to=<requested-path>` via `requireOperatorSession`.
- `/pulse/system/*` routes require `is_system_admin=true` via `requireSystemAdminSession`.
- Non-admin users on `/pulse/system/*` redirect to `/pulse`.

### Legacy aliases
- `/pulse/systems` -> `/pulse/system`
- `/system` -> `/pulse/system`
- `/system/platform` -> `/pulse/system/platform`
- `/system/pipeline` -> `/pulse/system/pipeline`
- `/system/extensions` -> `/pulse/system/extensions`
- `/system/customers` -> `/pulse/system/customers`
- `/system/growth` -> `/pulse/system/growth`
- `/system/expansion` -> `/pulse/system/expansion`
- `/system/reliability-patterns` -> `/pulse/system/reliability-patterns`
- `/system/intelligence` -> `/pulse/system/intelligence`

## 3) Settings Coverage Status

### Present and visible
- Appearance
- Integrations
- Security
- Project Settings
- Organization Settings
- Members
- Alert Settings
- Notifications
- Services / Systems
- System links (admin-only): Platform, Pipeline, Extensions, Customers, Growth, Expansion, Reliability, Intelligence

### Status model
- `Mapped`: currently wired
- `Partial`: partially wired (visibility + baseline destination)
- `Planned`: visible with stable destination, deeper wiring deferred

## 4) Shared Data-Helper Cleanup Review

No refactor applied in this pass to avoid behavior drift.

Observed duplication remains acceptable for current migration freeze:
- auth-backed fetch wrappers
- source error shaping
- empty-state defaults

Deferred cleanup candidate (post-freeze):
- `apps/pulse/lib/data/fetch-json.ts`
- `apps/pulse/lib/data/source-status.ts`
- `apps/pulse/lib/data/safe-normalize.ts`

## 5) Smoke Test Matrix

### Executed
- Build/lint:
  - `pnpm --filter pulse lint` ✅
  - `pnpm --filter pulse build` ✅

### Manual verification log (2026-05-07)
- Signed-out protected redirect matrix verified:
  - `/pulse`, `/incidents?x=1`, `/traces`, `/settings`, `/on-call`, `/pulse/system`, `/pulse/system/platform`
  - all redirect to `/sign-in?return_to=...` with requested path preserved
- Signed-in operator routes verified:
  - `/pulse`, `/incidents`, `/traces`, `/settings`, `/on-call` load successfully
- Legacy alias behavior verified:
  - `/pulse/systems` resolves to `/pulse/system`
  - `/system/*` aliases resolve to `/pulse/system/*`
- System-admin gating verified with DB role flip (admin CLI disabled in this environment):
  - update both `operator_users.is_system_admin` and `users.is_system_admin` for `owner@acme.test`
  - re-sign-in to refresh session
  - non-admin session payload confirmed `is_system_admin=false`
  - `/pulse/system` guard emits server redirect to `/pulse`
  - admin restored and `/pulse/system/*` access confirmed
- Demo mode verified:
  - `/pulse?demo=1` loads demo snapshot data after sign-in return
  - note: route remains auth-protected by design

### Manual matrix (required for release sign-off)
- Signed out:
  - `/pulse` -> sign-in redirect
  - `/pulse/system` -> sign-in redirect
- Signed in (non-admin):
  - Core routes accessible
  - `/pulse/system/*` redirects to `/pulse`
- Signed in (system admin):
  - Core + system routes accessible
- Demo mode:
  - `/pulse` clearly labeled demo when `demo=1`
- Failed API/source unavailable:
  - each parity page shows compact unavailable notice and safe empty state

Status: core matrix completed; keep one follow-up browser check for sign-out button visibility (non-blocking).

## 6) Known Remaining Gaps (Post-Parity)

1. Alias retention debt
- Legacy `/system/*` aliases intentionally retained for compatibility.
- Can be removed in a follow-up once external links/bookmarks are migrated.

2. Manual validation completeness
- Browser verification across non-admin/admin/demo/unavailable states still required each release candidate.

3. Data-helper deduplication
- Deferred intentionally to keep migration behavior stable.

## 7) Freeze Recommendation

Migration is functionally complete for both core and system route parity.

Recommended next step:
- freeze parity scope
- run full manual smoke matrix
- only fix regressions found in smoke
- defer Phase 6 intelligence/automation until freeze review is complete.

## 8) Freeze Rules (effective now)
- No new route/data parity wiring.
- No UI restyling or new UI sections.
- Only critical regression fixes.
- Keep changes scoped and reversible for merge/PR packaging.
