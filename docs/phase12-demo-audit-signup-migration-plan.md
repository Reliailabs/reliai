# Phase 12 — Demo/Audit/Signup Migration Plan

## Scope

Define migration ownership and implementation sequencing for:

- `/demo`
- `/ai-reliability-audit`
- `/signup`

This plan is Phase 12 planning-only and does not authorize implementation work
on these routes until Phase 11 read-path controls are stable and accepted.

## Current state (May 17, 2026)

- `/demo` in Pulse is not yet a production-grade interactive simulation surface.
- `/ai-reliability-audit` exists as a marketing route in Pulse with CTA-driven flow.
- `/signup` is intentionally retained in `apps/web` per migration portability decisions.

## Slice status

| Slice | Status | Branch / PR state |
| --- | --- | --- |
| `P12.1` Contract-first fixture baseline | Complete (merged) | merged to `main` |
| `P12.2` Demo scenario engine | Complete (merged) | merged to `main` |
| `P12.3` Pulse `/demo` thin surface baseline | Complete (merged) | merged to `main` |
| `P12.4` Audit flow alignment | Complete (merged) | merged to `main` |
| `P12.5` Signup ownership decision | Complete (merged) | merged to `main` |
| `P12.6` Closure gate enforcement | Complete (merged) | merged to `main` |
| `P12.7` Demo ownership drift contract | Complete (merged) | merged to `main` |

## Ownership contract

### `/demo`

- Short term: keep CTA routing behavior explicit and non-deceptive.
- Target owner: Pulse (`apps/pulse`) in Phase 12 implementation slices.
- Must become a deterministic, replayable operational simulation and not a static walkthrough.

### `/ai-reliability-audit`

- Owner: Pulse marketing surface.
- Must keep CTA intent aligned with actual destination behavior.
- Must remain consistent with `/demo` ownership and narrative (audit entrypoint -> operational proof path).

### `/signup`

- Decision: keep owner in `apps/web` as shared growth/auth entrypoint.
- Pulse contract: provide `/signup` compatibility shim that redirects to configured external owner URL.
- Contract guardrails:
  - `NEXT_PUBLIC_RELIAI_SIGNUP_URL` must resolve to absolute `http(s)` `/signup`.
  - unset/invalid/ambiguous values fall back to `/sign-in` (safe local auth path).
  - local `/signup` self-loop values are rejected.

## Phase 12 implementation sequence

1. `P12.1` Contract-first fixture baseline for demo
- Define demo read-model fixtures aligned to production shapes.
- Add schema parity tests between demo fixtures and production read models.
- No UI expansion in this step.
- Initial baseline landed:
  - `apps/pulse/lib/demo-scenario-fixtures.ts`
  - `apps/pulse/tests/demo-scenario-fixtures.test.ts`
  - command: `pnpm --filter pulse test:phase12-demo-fixture-baseline`

2. `P12.2` Demo scenario engine
- Implement deterministic replay timeline and state controller.
- Enforce stable IDs/outcomes for repeatable sales/investor/demo runs.
- Baseline engine landed:
  - `apps/pulse/lib/demo-scenario-engine.ts`
  - `apps/pulse/tests/demo-scenario-engine.test.ts`
  - command: `pnpm --filter pulse test:phase12-demo-scenario-engine`
- Still no UI work in this step.

3. `P12.3` Pulse `/demo` surface migration
- Build/port real interactive demo surface in Pulse.
- Remove ambiguous fallback/placeholder behavior.
- Thin surface baseline landed:
  - `apps/pulse/app/demo/page.tsx`
  - `apps/pulse/components/demo/demo-scenario-surface.tsx`
  - `apps/pulse/tests/demo-surface-smoke.test.tsx`
  - command: `pnpm --filter pulse test:phase12-demo-surface-smoke`
- Current implementation is intentionally offline deterministic and fixture-engine backed.

4. `P12.4` Audit flow alignment
- Ensure `/ai-reliability-audit` CTA chain maps to real demo/audit outcomes.
- Remove any copy/route contract mismatches.
- Alignment baseline landed:
  - `apps/pulse/components/marketing-linear/audit-page.tsx`
  - `apps/pulse/tests/audit-flow-alignment.test.tsx`
  - command: `pnpm --filter pulse test:phase12-audit-flow-alignment`

5. `P12.5` Signup ownership decision
- Explicitly decide owner for `/signup`.
- Document session/auth continuity implications.
- Implement only after decision acceptance.
- Implemented:
  - `apps/pulse/app/signup/page.tsx` (compatibility redirect shim)
  - `apps/pulse/lib/signup-link.ts`
  - `apps/pulse/tests/signup-link.test.ts`
  - command: `pnpm --filter pulse test:phase12-signup-ownership-contract`

## Acceptance criteria

- `/demo` is deterministic and replayable.
- Demo fixtures use production-shaped read models.
- `/ai-reliability-audit` intent and destination behavior are aligned.
- `/signup` ownership is explicitly documented and reflected in routing behavior.
- No contradictory copy-to-route behavior for marketing CTAs.

## Validation gate

- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Targeted contract tests for fixture/read-model parity
- Targeted e2e/route probes for CTA destination correctness
- Canonical aggregated gate:
  - `pnpm --filter pulse test:phase12-route-ownership-gate`
  - enforced in `.github/workflows/qa.yml` (`pulse-route-gate`)
  - includes `pnpm --filter pulse test:phase12-demo-route-ownership-contract`

## Phase 12 closure note

- Implementation slices `P12.1` to `P12.5` are complete.
- Route/ownership contract tests are aggregated and CI-enforced via `P12.6`.
- Remaining work for `/demo` depth is iterative product enhancement, not unresolved ownership ambiguity.

## Out of scope

- WorkOS invite lifecycle implementation
- net-new backend write-path semantics unrelated to demo/audit/signup ownership
- phase expansion outside this route set
