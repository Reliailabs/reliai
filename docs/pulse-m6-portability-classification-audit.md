# Pulse M6 Portability Classification Audit

Date: 2026-05-13

## Gate
- Classification: `Migration`
- Net-new behavior: `No`
- Source-of-truth checked: `apps/web`

## Route Classification Matrix

| Route | Source (`apps/web`) | Pulse status | Decision | Notes |
|---|---|---|---|---|
| `/settings` | Present | Present | Migrate | Portability audit classification only. |
| `/settings/billing` | Present | Missing | Keep in apps/web | Explicitly waived from Pulse migration readiness gate in M7.8 decision doc. |
| `/playground` | Present | Present | Migrate | Pulse route now wired in app shell; current implementation is migration-safe/read-only. |
| `/docs` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/docs-marketing` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/pricing` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/signup` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/onboarding` | Present | Missing | Keep in apps/web | Explicitly waived from Pulse migration readiness gate in M7.8 decision doc. |
| `/billing/success` | Present | Missing | Keep in apps/web | Explicitly waived from Pulse migration readiness gate in M7.8 decision doc. |

## Findings
- `apps/pulse` already has `/settings` and keeps core app-auth settings surface active.
- `apps/pulse` does not currently expose `/settings/billing` in app shell.
- Public and growth routes (`/docs`, `/docs-marketing`, `/pricing`, `/signup`) remain in `apps/web` as intended.
- `/onboarding` and `/billing/success` remain owned by `apps/web` under explicit migration waiver.

## Decision
M6 portability decision is explicit for current migration target: `/docs`, `/docs-marketing`, `/pricing`, `/signup`, `/settings/billing`, `/onboarding`, and `/billing/success` remain in `apps/web`. Pulse owns `/settings` and `/playground`.

## Phase 9 Impact
Phase 9 remains blocked by migration completion gate until portability classifications and remaining migration slices are accepted.
