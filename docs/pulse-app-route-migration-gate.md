# App Route Migration Gate

Date: 2026-05-14
Status: Active
Scope: Pulse migration readiness hardening

## Canonical Routes
- `/pulse/system` is canonical.
- `/system` is a legacy alias and must redirect to `/pulse/system`.
- `/onboarding` is app-owned and must render through the shared app shell.

## Required Checks
1. Authenticated `/onboarding` renders inside shared shell.
2. Authenticated `/pulse/system` renders inside shared shell.
3. Anonymous `/onboarding?...` redirects to `/sign-in?return_to=...` preserving full path+query.
4. Anonymous `/system` redirects with return path preserved.
5. `/system` canonicalizes to `/pulse/system` after auth.
6. Sidebar route transitions do not produce hydration errors between app routes.
7. Mobile viewport keeps shell/nav usable.
8. No app-owned pages exist outside `(app)` unless explicitly documented as public/auth/redirect shims.

## Automated Contract (Implemented)
Run:
- `pnpm --filter pulse test:app-route-gate`

Current automated coverage:
- Check 1: onboarding route owned under `(app)` + page shell wrapper assertion.
- Check 2: `/pulse/system` layout shell wrapper assertion.
- Check 3: proxy redirect assertion for anonymous onboarding deep link query.
- Check 4: proxy redirect assertion for anonymous `/system`.
- Check 5: `/system` page canonical redirect assertion to `/pulse/system`.
- Check 8: route-tree guard enforces that non-API pages outside `(app)` are only:
  - `app/(marketing)/page.tsx`
  - `app/sign-in/page.tsx`
  - `app/demo/page.tsx`

## Playwright Smoke (Wired)
Run:
- Local/dev smoke: `pnpm --filter pulse test:e2e:app-route-gate`
- CI/release gate (auth required): `pnpm --filter pulse test:e2e:app-route-gate:ci`

Credentials for authenticated checks:
- `PW_E2E_EMAIL=<seed-email>`
- `PW_E2E_PASSWORD=<seed-password>`

Current Playwright coverage:
- Check 6: sidebar route transitions (`/pulse` -> `/onboarding` -> `/settings` -> `/pulse`) fail on hydration/runtime errors.
- Check 7: mobile viewport smoke (`390x844`) verifies shell/nav usability on `/onboarding` and `/pulse/system`.
- Anonymous redirect smoke verifies `return_to` semantics for `/onboarding?...` and `/system`.

## Execution Policy
- Local/dev mode may skip authenticated checks and reports `SKIPPED_AUTH_E2E`.
- CI/release mode must not skip authenticated checks:
  - enforced by `PW_REQUIRE_AUTH_E2E=1` (and implicitly when `CI=true`)
  - test run fails fast when auth credentials are missing.

## Isolation Rule
Pulse migration e2e is intentionally isolated from `apps/web` QA.

Forbidden in Pulse migration gate tests:
- importing `apps/web` fixtures/helpers/selectors
- asserting `apps/web` routes or web-only selectors
- sharing cross-app helper logic unless promoted into an explicit app-neutral package with contracts owned by both apps

## Web QA Pause Control
- `apps/web` QA is intentionally paused during active Pulse migration gate work.
- CI control is explicit via GitHub Actions variable:
  - `RUN_WEB_QA=true` enables `web-qa` job
  - any other value keeps it paused
- Current release-critical target during this window is Pulse.
- `web-qa` must be re-enabled once Pulse migration stabilization closes.

## Remaining Follow-Up
- Expand mobile sweep to include tablet viewport (`768x1024`) and project-scoped routes.
