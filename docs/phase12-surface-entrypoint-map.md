# Phase 12 Surface Entrypoint Map

## Purpose

Prevent regression into:

- silent ownership transitions
- dead demo paths
- CTA label/destination mismatch

This document is a route-behavior contract for public Phase 12 entry surfaces.

## Canonical public entrypoints

| Entrypoint route | Owner | User-visible behavior | Transition target | Guardrails |
|---|---|---|---|---|
| `/demo` | `apps/pulse` | Renders Pulse-owned deterministic demo surface | Internal demo flow only | Must not redirect to marketing clone or external env bridge |
| `/ai-reliability-audit` | `apps/pulse` | Renders audit entrypoint with explicit CTA into demo | `/demo` | CTA copy must match actual destination behavior |
| `/signup` | External owner + Pulse bridge | Renders explicit ownership bridge surface with continue action | `resolveSignupHref(...)` result | Must preserve query params; invalid/unset targets fall back to `/sign-in`; local `/signup` self-loop rejected |

## Ownership transition rules

1. `/demo` is a destination surface, not a redirect shim.
2. `/ai-reliability-audit` must explicitly route users to `/demo` when claiming demo/audit walkthrough behavior.
3. `/signup` transition must remain visible to users. Silent immediate redirects are disallowed.

## Anti-regression checklist

1. No route in this map performs an unannounced ownership redirect.
2. No CTA labels promise behavior that the destination route does not provide.
3. `/demo` remains Pulse-rendered and deterministic on repeated reload.
4. `/signup` query values survive transition to destination target.
5. Fallback path for invalid signup owner URL remains `/sign-in`.

## Validation references

- `pnpm --filter pulse test:phase12-route-ownership-gate`
- `pnpm --filter pulse exec node --import tsx --test tests/demo-route-ownership-contract.test.ts`
- `pnpm --filter pulse exec node --import tsx --test tests/audit-flow-alignment.test.tsx`
- `pnpm --filter pulse exec node --import tsx --test tests/signup-link.test.ts`

## Source references

- `/Users/robert/Documents/Reliai/apps/pulse/app/demo/page.tsx`
- `/Users/robert/Documents/Reliai/apps/pulse/components/demo/demo-scenario-surface.tsx`
- `/Users/robert/Documents/Reliai/apps/pulse/components/marketing-linear/audit-page.tsx`
- `/Users/robert/Documents/Reliai/apps/pulse/app/signup/page.tsx`
- `/Users/robert/Documents/Reliai/apps/pulse/lib/signup-link.ts`
