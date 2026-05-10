# Pulse M6 — Settings/Onboarding/Billing/Docs/Playground Portability Plan

## Classification
- Migration planning only
- Net-new behavior: No
- Source of truth: `apps/web`

## Route decisions
- Migrate to Pulse app shell:
  - `/settings`
  - `/settings/billing` (app-auth billing view only if required in Pulse)
  - `/playground` (only if operationally required)
- Keep in `apps/web` (public or growth-facing):
  - `/docs`
  - `/docs-marketing`
  - `/pricing`
  - `/signup`
- Conditional migrate:
  - `/onboarding` (only if Pulse has standalone first-run path)
  - `/billing/success` (only if Pulse initiates billing flow)

## Guardrails
- No marketing migration into Pulse.
- No billing contract changes.
- No auth-flow rewrites.

## Completion criteria
- Every route above is explicitly marked `Migrate`, `Keep`, or `Conditional` in audit sheet notes.
