# Pulse Runtime Parity Audit Report

Status: Partial (contract/runtime probes passed; authenticated E2E proof blocked by missing credentials)
Date: 2026-05-24
Scope: Post-migration runtime proof for `apps/pulse`

## Results

### 1) Contract/runtime probes
- Result: **PASS**
- Command set:
  - `pnpm --filter pulse exec node --import tsx --test tests/project-scope-data.test.ts tests/project-scope-route-continuity.test.ts tests/non-project-route-scope-continuity.test.ts tests/response-team-functional-continuity.test.ts tests/auth-tenancy-trust-boundary.test.ts tests/auth-callback-link.test.ts tests/billing-ownership-contract.test.ts`
- Outcome:
  - `56 passed, 0 failed`

### 2) Authenticated E2E route-shell runtime probes
- Result: **INCOMPLETE**
- Command:
  - `pnpm --filter pulse exec playwright test -c playwright.config.ts tests/e2e/app-route-shell.spec.ts`
- Outcome:
  - `1 passed, 15 skipped, 0 failed`
- Blocker:
  - Missing required credentials:
    - `PW_E2E_EMAIL`
    - `PW_E2E_PASSWORD`

## Release Note Caveat

Contract/runtime probes passed; authenticated E2E route-shell probes were skipped due to missing credentials.

## Authenticated E2E CI Status Semantics

- `SKIPPED_CREDENTIALS_ABSENT`
  - meaning: authenticated E2E was not executed because `PW_E2E_EMAIL` and/or `PW_E2E_PASSWORD` were not configured.
  - CI behavior: explicit fail-fast precheck with clear missing-secret message.
- `FAILED_E2E_BROKEN`
  - meaning: credentials were present and authenticated E2E executed but one or more probes failed.
  - CI behavior: `pnpm --filter pulse test:e2e:app-route-gate:ci` failed.
- `PASSED_AUTHENTICATED_E2E`
  - meaning: credentials were present and authenticated E2E executed successfully.
  - CI behavior: route-shell authenticated E2E gate passed.

## Skip Elimination Classification (Route-Shell E2E)

The prior authenticated suite had 7 environment-conditional skips. Those branches are removed from CI runtime parity proof.

- `missing seed data`:
  - operations incident link unavailable
  - regressions detail link unavailable
  - handling now: hard assertion on explicit empty-state surfaces (`No events match...`, `No incidents found`, `No regressions found...`) instead of skip.
- `bad test assumption`:
  - required two selectable projects to prove continuity
  - required pre-existing scoped query in traces/on-call/settings
  - handling now: tests assert canonical scope behavior with at least one project option and deterministic URL/query checks.
- `unsupported CI dependency / auth context drift`:
  - operations/traces/regressions route fallback paths
  - handling now: hard route assertions in authenticated mode (no skip fallback in CI proof path).
- `invalid-scope guard ambiguity`:
  - deep-link invalid `project_id` accepted in some environments
  - handling now: hard fail-closed assertions for incident/regression/graph deep links.

Only one skip path remains by design:
- `SKIPPED_AUTH_E2E` when credentials are intentionally absent outside strict CI mode.

## Integrity Hardening Added In This Slice

- Added incident/operations write-intent contract checks:
  - `apps/pulse/tests/incidents-ops-integrity-contract.test.ts`
- Coverage enforces:
  - explicit write intent (`POST`/`PATCH`) on incident action routes
  - fail-closed auth guard (`401 unauthorized` without token)
  - degraded dependency fail-closed behavior (`500` on fetch exceptions)
