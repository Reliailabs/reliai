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
| `P12.8` Demo impact/outcome contract depth | Complete (merged) | merged to `main` |
| `P12.9` Replay resilience state contract | Complete (merged) | merged to `main` |
| `P12.10` Health-dimension split contract | Complete (merged) | merged to `main` |
| `P12.11` Dual-health policy semantics | Complete (merged) | merged to `main` |
| `P12.12` Integrity contract unification | Complete (merged) | merged to `main` |
| `P12.13` Operational conclusion guard reasons | Complete (merged) | merged to `main` |
| `P12.14` Blocked-state surface proof | Complete (merged) | merged to `main` |
| `P12.15` Conclusion completion gate | Complete (merged) | merged to `main` |
| `P12.16` Conclusion success-path surface proof | Complete (merged) | merged to `main` |
| `P12.17` Replay conclusion transition proof | Complete (merged) | merged to `main` |
| `P12.18` Mitigation message contract alignment | Complete (merged) | merged to `main` |
| `P12.19` Health label contract alignment | Complete (merged) | merged to `main` |
| `P12.20` Operational decision integrity policy | Complete (merged) | merged to `main` |
| `P12.21` Operational decision evidence checklist contract | Complete (merged) | merged to `main` |
| `P12.22` Operational decision evidence summary contract | Complete (this branch) | `feat/pulse-phase12-22-operational-evidence-summary-contract` |

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

6. `P12.8` Demo impact/outcome contract depth
- Add deterministic business-impact and mitigation-outcome fields to scenario fixture.
- Surface business impact and counterfactual text in the Pulse `/demo` experience.
- Keep implementation offline deterministic and fixture-backed.

7. `P12.9` Replay resilience state contract
- Add deterministic replay-health semantics for stale/partial/unknown states.
- Ensure `/demo` renders explicit fallback state labels without live dependencies.
- Add replay resilience test coverage to prevent silent state-handling drift.
- Apply operational consequences by health state:
  - downgrade mitigation confidence language for non-healthy states
  - surface explicit evidence-integrity notes for partial/stale/unknown states

8. `P12.10` Health-dimension split contract
- Separate `replay_integrity` health from `scenario` health semantics.
- Enforce independent policy notes and trust levels for each dimension.
- Gate mitigation conclusion on both policy dimensions (not replay label alone).

9. `P12.11` Dual-health policy semantics
- Ensure replay integrity and scenario trust remain separate operational dimensions.
- Keep mitigation conclusion blocked unless both dimensions are healthy.
- Add explicit scenario notes and labels so partial/stale/unknown outcomes are visible to operators.

10. `P12.12` Integrity contract unification
- Consolidate replay/scenario policy logic into one contract module:
  - `apps/pulse/lib/demo-operational-integrity-contract.ts`
- Centralize health derivation from fixture profiles and mitigation-conclusion gating.
- Remove split policy modules to prevent policy sprawl and semantic drift.
- Replace split policy tests with unified contract tests:
  - `apps/pulse/tests/demo-operational-integrity-contract.test.ts`

11. `P12.13` Operational conclusion guard reasons
- Preserve deterministic mitigation gating while making block reasons explicit.
- Add a typed decision contract for conclusions:
  - allowed/not-allowed
  - deterministic block reason enum
- Surface block reason text in `/demo` when conclusions are not trustworthy.
- Add contract tests for `unknown` replay/scenario combinations and reason mapping.

12. `P12.14` Blocked-state surface proof
- Add deterministic render coverage for non-healthy replay/scenario outcomes on `/demo`.
- Prove operational block reasons render correctly for:
  - replay unknown + scenario healthy
  - replay unknown + scenario unknown
- Add test-only fixture injection path on `DemoScenarioSurface` to avoid introducing runtime behavior drift.

13. `P12.15` Conclusion completion gate
- Treat replay completion status as a first-class conclusion precondition.
- Block mitigation conclusions with explicit reason when replay is not complete.
- Keep health policy checks intact after completion precondition is satisfied.
- Extend surface smoke coverage to verify pre-completion blocked-state rendering.

14. `P12.16` Conclusion success-path surface proof
- Add deterministic render proof for the positive conclusion path on `/demo`.
- Verify mitigation outcome is shown when:
  - replay is complete
  - replay health is trusted
  - scenario health is trusted
- Verify blocked-label text is absent in this allowed-conclusion state.

15. `P12.17` Replay conclusion transition proof
- Add a deterministic transition test linking replay progression to conclusion eligibility.
- Prove initial replay frame blocks conclusions with `replay_not_complete`.
- Prove post-completion replay frame allows conclusions with `none` block reason when health is trusted.
- Wire this test into the canonical `phase12-route-ownership-gate`.

16. `P12.18` Mitigation message contract alignment
- Centralize mitigation pending/success and block reason message mapping in contract helpers.
- Remove duplicated message selection logic from the `/demo` presenter.
- Add deterministic helper coverage to prevent future copy-to-contract drift.

17. `P12.19` Health label contract alignment
- Move replay/scenario health label mapping from presenter logic into contract helpers.
- Ensure label semantics are contract-owned and test-enforced.
- Eliminate ad hoc presenter-side label branching.

18. `P12.20` Operational decision integrity policy
- Add contract-layer operational decision integrity evaluator:
  - evidence presence requirements
  - causal chain requirement
  - severity/evidence alignment
  - AREI linkage requirement
- Return plural deterministic policy reasons (`policy_reasons`) without short-circuiting.
- Enforce confidence coupling:
  - disallowed conclusions => `low`
  - allowed with complete trusted evidence => `high`
  - allowed degraded integrity (explicitly configured) => `degraded`

19. `P12.21` Operational decision evidence checklist contract
- Add contract-owned deterministic evidence checklist output for operator reasoning:
  - replay completion
  - replay/scenario integrity trust
  - mitigation/rollback evidence presence
  - causal chain completeness
  - severity/evidence alignment
  - AREI linkage to mitigation
- Preserve fixed ordering and explicit blocking flags per requirement.
- Keep slice contract-only (no layout/marketing changes).

20. `P12.22` Operational decision evidence summary contract
- Add contract-owned summary projection derived from the same integrity input:
  - total/satisfied/blocking requirement counts
  - deterministic blocking reasons
  - deterministic blocking reason messages
- Enforce that summary reasons follow `evaluateMitigationConclusionIntegrity(...)` outputs.
- Keep slice contract-only (no layout/marketing changes).

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

## Phase 12 progress note

- Implementation slices `P12.1` to `P12.19` are merged.
- `P12.20` is merged.
- `P12.21` is merged.
- `P12.22` adds deterministic operational evidence summary outputs and tests.
- Route/ownership contract tests remain aggregated and CI-enforced via `P12.6`.
- Remaining work for `/demo` depth is iterative product enhancement, not unresolved ownership ambiguity.

## Out of scope

- WorkOS invite lifecycle implementation
- net-new backend write-path semantics unrelated to demo/audit/signup ownership
- phase expansion outside this route set
