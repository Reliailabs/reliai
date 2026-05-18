# Phase 12 — Demo/Audit/Signup Migration Plan

## Scope

Define migration ownership, acceptance criteria, and validation gates for:

- `/demo`
- `/ai-reliability-audit`
- `/signup`

## Status

- Phase 12 execution slices `P12.1` to `P12.26`: **Complete and merged**.
- Phase 12 route/ownership gate: **active in CI** (`pulse-route-gate`).
- Remaining work: **follow-up hardening only** (no unresolved route ownership decisions).

## Ownership contracts

### `/demo`

- Owner: Pulse (`apps/pulse`).
- Contract: deterministic, replayable operational simulation (not static marketing walkthrough).
- Must remain offline-deterministic from production systems and LLM providers.

### `/ai-reliability-audit`

- Owner: Pulse marketing surface.
- Contract: CTA intent and destination behavior must stay aligned with actual `/demo` flow.

### `/signup`

- Owner: `apps/web` (external growth/auth entrypoint).
- Pulse contract: `/signup` compatibility shim + safe fallback behavior.
- Guardrails:
  - `NEXT_PUBLIC_RELIAI_SIGNUP_URL` must be absolute `http(s)` and target `/signup`.
  - unset/invalid/ambiguous values fall back to `/sign-in`.
  - local self-loop `/signup` targets are rejected.

## Acceptance criteria

- `/demo` is deterministic and replayable.
- Demo fixtures remain production-shaped.
- `/ai-reliability-audit` copy and destination behavior are contract-aligned.
- `/signup` ownership and routing behavior are explicit and stable.
- No contradictory CTA copy-to-route behavior.

## Validation commands

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- `pnpm --filter pulse test:phase12-route-ownership-gate`

## CI-enforced gates

- `.github/workflows/qa.yml` via `pulse-route-gate`
- includes `pnpm --filter pulse test:phase12-demo-route-ownership-contract`

## Manual reviewer checks

- Verify CTA labels match actual destination behavior (`/ai-reliability-audit` -> `/demo` chain).
- Verify presenter layers consume contract outputs directly and do not reinterpret integrity semantics.
- Verify any new demo behavior remains deterministic under repeated reload/replay.
- Verify no live provider dependency was introduced into demo state/rendering paths.

## Canonical artifacts

Primary implementation and contract boundaries:

- `apps/pulse/lib/demo-scenario-fixtures.ts`
- `apps/pulse/lib/demo-scenario-engine.ts`
- `apps/pulse/lib/demo-operational-integrity-contract.ts`
- `apps/pulse/components/demo/demo-scenario-surface.tsx`
- `apps/pulse/app/demo/page.tsx`
- `apps/pulse/components/marketing-linear/audit-page.tsx`
- `apps/pulse/app/signup/page.tsx`
- `apps/pulse/lib/signup-link.ts`

Primary test surfaces:

- `apps/pulse/tests/demo-scenario-fixtures.test.ts`
- `apps/pulse/tests/demo-scenario-engine.test.ts`
- `apps/pulse/tests/demo-replay-conclusion-transition.test.ts`
- `apps/pulse/tests/demo-operational-integrity-contract.test.ts`
- `apps/pulse/tests/demo-surface-smoke.test.tsx`
- `apps/pulse/tests/demo-surface-block-reasons.test.tsx`
- `apps/pulse/tests/demo-route-ownership-contract.test.ts`
- `apps/pulse/tests/audit-flow-alignment.test.tsx`
- `apps/pulse/tests/signup-link.test.ts`

## Follow-ups

- Keep this document as a contract/gate reference only; detailed execution history belongs in PRs and changelog, not inline phase logs.

### Follow-up slice template

Use this for any post-closure `P12.x` slice:

- `slice_id`: `P12.x`
- `scope`: one-line boundary (contract-only, presenter-consumption-only, docs-only, etc.)
- `routes_touched`: `/demo`, `/ai-reliability-audit`, `/signup` (or `none`)
- `invariants_touched`:
  - deterministic replay
  - no presenter reinterpretation
  - contract-owned decision semantics
  - CTA label/destination alignment
  - no live provider runtime dependency
- `validation`:
  - `pnpm --filter pulse test:phase12-route-ownership-gate`
  - any additional targeted tests
- `risk_rollback`: concise rollback note

#### Required PR body snippet

```md
### Phase12 Follow-up Contract
- slice_id: P12.x
- scope: <contract-only | presenter-consumption-only | docs-only | ...>
- routes_touched: < /demo | /ai-reliability-audit | /signup | none >
- invariants_touched:
  - deterministic replay
  - no presenter reinterpretation
  - contract-owned decision semantics
  - CTA label/destination alignment
  - no live provider runtime dependency
- validation:
  - pnpm --filter pulse test:phase12-route-ownership-gate
  - <additional targeted checks>
- risk_rollback: <one line>
```

## Operational invariants

- Demo behavior must remain deterministic and replayable.
- Presenter layers must not reinterpret integrity policy.
- Operational decision semantics are contract-owned.
- CTA labels must match real route behavior.
- Demo state must not depend on live provider availability.

## Out of scope

- WorkOS invite lifecycle implementation
- Net-new backend write-path semantics unrelated to demo/audit/signup ownership
- Phase expansion outside this route set
