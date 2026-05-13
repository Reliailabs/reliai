# Pulse M7.8 — Conditional Ownership Decision (Onboarding & Billing)

Date: 2026-05-13

## Scope
This decision covers conditional migration ownership for:
- `/settings/billing`
- `/billing/success`
- `/onboarding`

## Source of Truth
- Source app: `apps/web`
- Classification baseline: `docs/pulse-m6-portability-classification-audit.md`

## Decision Status
- `/settings/billing`: **Keep in `apps/web` (Waived for Pulse migration readiness gate)**
- `/billing/success`: **Keep in `apps/web` (Waived for Pulse migration readiness gate)**
- `/onboarding`: **Keep in `apps/web` (Waived for Pulse migration readiness gate)**

These routes are explicitly out of Pulse ownership for the current migration target.

## Rationale
- They include billing and onboarding lifecycle behavior that is broader than current M7 project-route parity.
- Pulling them into Pulse now would expand scope and risk beyond the locked migration gate.
- Current readiness target remains `apps/web operational parity` with explicit deferred-write tracking.

## Required Preconditions Before Ownership Transfer
1. Confirm product owner approval for Pulse ownership of each route individually.
2. Confirm contract parity for backend/API dependencies and callback handling.
3. Confirm auth/return-path behavior and post-action destination behavior.
4. Add rollback plan for billing/onboarding flow regressions.

## Acceptance Rule
No implementation for these routes in Pulse should start unless a new migration decision explicitly reclassifies a route to **Approved for Migration**.

## Current Outcome
- Keep route ownership in `apps/web` for now.
- Conditional ownership is now explicitly resolved as an ownership waiver for this migration gate.
