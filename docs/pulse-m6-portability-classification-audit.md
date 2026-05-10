# Pulse M6 Portability Classification Audit

Date: 2026-05-10

## Gate
- Classification: `Migration`
- Net-new behavior: `No`
- Source-of-truth checked: `apps/web`

## Route Classification Matrix

| Route | Source (`apps/web`) | Pulse status | Decision | Notes |
|---|---|---|---|---|
| `/settings` | Present | Present | Migrate | Portability audit classification only. |
| `/settings/billing` | Present | Missing | Conditional | Portability audit classification only. |
| `/playground` | Present | Missing | Migrate | Portability audit classification only. |
| `/docs` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/docs-marketing` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/pricing` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/signup` | Present | Missing | Keep in apps/web | Portability audit classification only. |
| `/onboarding` | Present | Missing | Conditional | Portability audit classification only. |
| `/billing/success` | Present | Missing | Conditional | Portability audit classification only. |

## Findings
- `apps/pulse` already has `/settings` and keeps core app-auth settings surface active.
- `apps/pulse` does not currently expose `/settings/billing` or `/playground` routes in app shell.
- Public and growth routes (`/docs`, `/docs-marketing`, `/pricing`, `/signup`) remain in `apps/web` as intended.
- `/onboarding` and `/billing/success` remain conditional until explicit Pulse flow ownership is approved.

## Decision
M6 portability remains **Partial** and docs-gated. No migration implementation should begin for conditional routes without explicit ownership approval and contract checks.

## Phase 9 Impact
Phase 9 remains blocked by migration completion gate until portability classifications and remaining migration slices are accepted.