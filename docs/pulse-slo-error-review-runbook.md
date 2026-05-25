# Pulse SLO / Error Review Runbook

Status: Active
Date: 2026-05-24
Scope: Operational review for Pulse production validation

Reference: `docs/pulse-production-validation-stack.md`

## Inputs

- Pulse app logs and API logs
- Runtime error stream (client + server)
- Route-level latency/error metrics
- CI checks for `main`:
  - `QA / pulse-route-gate`
  - authenticated E2E strict route-shell step

## Review Cadence

- During Phase A/B rollout: every 2 hours
- During first 24h at 100%: every 4 hours
- After stabilization: daily

## SLO/Threshold Table

- Auth/session failures (`401/403` unexpected on protected routes):
  - Warning: > 0.5% / 15m
  - Fail rollout: > 1.0% / 15m
- Project-scope violations (cross-project leaks or invalid scope not denied):
  - Warning: >= 1 event / 60m
  - Fail rollout: >= 1 event / 15m
- Incident/operations write-path 5xx:
  - Warning: > 0.25% / 15m
  - Fail rollout: > 0.5% / 15m
- Billing/settings 5xx:
  - Warning: > 0.25% / 15m
  - Fail rollout: > 0.5% / 15m
- Route-shell runtime regressions (hydration/runtime boundary):
  - Warning: >= 3 occurrences / 30m
  - Fail rollout: >= 5 occurrences / 30m
- p95 latency (`/onboarding`, `/operations`, `/settings`, `/billing`):
  - Warning: > 2.0s / 30m
  - Fail rollout: > 2.5s / 30m

## Query/Review Checklist

For each review window:
1. Check auth/session failure rate by route.
2. Check scope-denial and scope-violation events.
3. Check incident/operations write-path status distribution.
4. Check billing/settings status distribution.
5. Check client runtime/hydration errors by route.
6. Check p95 latency for core routes.
7. Confirm `pulse-route-gate` + strict authenticated E2E remain green on `main`.

## Decision Outcomes

- `continue`:
  - no fail thresholds reached
  - warnings, if any, are stable and explained
- `hold`:
  - warning thresholds reached without fail threshold
  - mitigation owner assigned with ETA
- `rollback`:
  - any fail threshold reached
  - unresolved data integrity risk

## Incident Response Ownership

- Auth/session failures: app auth owner + platform owner
- Scope violations: tenancy/security owner
- Incident/operations integrity failures: operations API owner
- Billing/settings failures: billing owner + settings owner
- Runtime regressions: frontend owner

## Mandatory Artifacts Per Review Window

- timestamped metric snapshot
- failing queries/log excerpts (if any)
- decision (`continue|hold|rollback`)
- responder + approver names
- follow-up issue/incident IDs

No artifact means no valid review decision.
