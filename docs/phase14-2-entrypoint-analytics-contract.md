# Phase 14.2 — Entrypoint Analytics Contract

## Scope

Define a minimal, vendor-neutral navigation evidence layer for public entrypoints only.

Routes in scope:

- `/`
- `/demo`
- `/ai-reliability-audit`
- `/signup`

Event types in scope:

- `entrypoint_page_viewed`
- `entrypoint_primary_cta_clicked`
- `entrypoint_continuity_transition_executed`

## Non-goals

- No marketing analytics platform behavior
- No funnel stage expansion outside these routes
- No vendor SDK coupling in contract layer

## Canonical schema

Contract module:

- `/Users/robert/Documents/Reliai/apps/pulse/lib/entrypoint-analytics.ts`

Core types:

- `EntrypointRoute`
- `EntrypointSourceAttribution`
- `EntrypointAnalyticsEvent` (union of the 3 canonical events)
- `EntrypointAnalyticsAdapter` (single `track(event)` boundary)

## Allowed transition graph

Configured continuity transitions:

- `/` -> `/demo`, `/ai-reliability-audit`, `/signup`
- `/demo` -> `/`, `/ai-reliability-audit`, `/signup`
- `/ai-reliability-audit` -> `/`, `/demo`, `/signup`
- `/signup` -> `/`, `/demo`, `/ai-reliability-audit`

Anything outside this graph is ignored by continuity-transition emission.

## Source attribution preservation

Contract preserves attribution keys (when present):

- `utm_source`
- `utm_medium`
- `utm_campaign`
- optional `source_route`
- optional `referrer`

Signup bridge preserves query context only for conversion/ownership transition target (`Continue`), not for exploratory continuity links.

## Adapter policy (zero vendor lock)

- Contract emits through `EntrypointAnalyticsAdapter`.
- Default runtime adapter is local console logging.
- Server-side defaults to noop.
- Future vendor integrations attach by setting adapter; they do not alter event schema.

## Validation

- `pnpm --filter pulse exec node --import tsx --test tests/entrypoint-analytics-contract.test.ts`
- `pnpm --filter pulse exec node --import tsx --test tests/public-entrypoint-continuity.test.tsx tests/public-entrypoint-triad-contract.test.tsx tests/audit-flow-alignment.test.tsx tests/demo-surface-smoke.test.tsx tests/signup-surface-contract.test.tsx`
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
