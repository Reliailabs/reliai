# Pulse Production Validation Checklist

Status: Active
Date: 2026-05-24
Scope: Post-migration production validation for `apps/pulse` only

Reference: `docs/pulse-production-validation-stack.md`

## Rollout Phases

### Phase A — Canary (5% traffic, minimum 24h)
- Entry criteria:
  - `QA / pulse-route-gate` green on `main`
  - Authenticated E2E route-shell strict gate green (`PW_REQUIRE_AUTH_E2E=1`)
  - No Sev-1/Sev-2 open incidents for Pulse core paths
- Stop conditions (immediate halt + rollback):
  - auth/session failure rate > 1.0% over 15 minutes
  - project-scope violation event > 0 in any 15 minute window
  - incident/operations write-path 5xx rate > 0.5% over 15 minutes
  - billing/settings route 5xx rate > 0.5% over 15 minutes
  - route-shell/runtime regression alert triggered

### Phase B — Limited (25% traffic, minimum 48h)
- Entry criteria:
  - Phase A completed without stop-condition trigger
  - No untriaged Sev-2 incidents from Phase A
- Stop conditions:
  - any Phase A stop condition
  - p95 route latency > 2.5s for `onboarding|operations|settings|billing` over 30 minutes
  - authenticated E2E gate regression on `main`

### Phase C — Broad (100% traffic)
- Entry criteria:
  - Phase B completed without stop-condition trigger
  - on-call responder assigned for first 24h at 100%
- Stop conditions:
  - any Phase A/B stop condition
  - sustained error budget burn > 20% in 24h for Pulse routes

## Required Signals (Must Be Monitored)

- Auth/session:
  - sign-in redirect loop rate
  - unauthorized responses on protected routes (`401/403`)
- Project scope/tenancy:
  - invalid scope denials
  - cross-project access denial checks
- Incident/operations integrity:
  - action route failure rates
  - proposal/verification fetch failure rates
- Billing/settings consistency:
  - checkout route failures
  - settings/team data fetch failures
- Runtime shell stability:
  - hydration/runtime client errors
  - route load error boundary frequency
- CI integrity:
  - `pulse-route-gate` status on `main`
  - authenticated E2E strict step status

## Required Responders

- Primary owner: Pulse app on-call engineer
- Secondary owner: API/platform on-call engineer
- Release authority: Engineering lead on duty

No phase can advance without named primary + secondary owners.

## Rollback Trigger and Procedure

- Trigger: any stop condition above.
- Procedure:
  1. Freeze rollout expansion immediately.
  2. Route traffic back to previous stable allocation.
  3. Open incident tagged `pulse-production-validation`.
  4. Capture failing signal evidence (query + timestamp + scope).
  5. Re-run `QA / pulse-route-gate` and authenticated E2E strict gate.
  6. Only resume rollout after root cause + fix are verified.

## Evidence Required Before Expanding Traffic

For each phase transition, capture and store:
- time window reviewed
- signal snapshots for all required signals
- list of incidents (or explicit none)
- CI gate status links
- reviewer decision with approver name and timestamp

Without this evidence package, rollout does not advance.
