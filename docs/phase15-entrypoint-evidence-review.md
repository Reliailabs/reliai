# Phase 15: Entrypoint Evidence Review

Status: Active (decision-doc slice)
Owner: Pulse migration
Scope type: analysis and decision only

## Purpose

Evaluate whether the four public entrypoints form a coherent user journey without adding UI churn, analytics expansion, or dashboards.

Entrypoints in scope:
- `/`
- `/demo`
- `/ai-reliability-audit`
- `/signup`

## Inputs Used (Existing Evidence Only)

1. Contract tests already in repo:
- `apps/pulse/tests/public-entrypoint-triad-contract.test.tsx`
- `apps/pulse/tests/public-entrypoint-continuity.test.tsx`
- `apps/pulse/tests/demo-route-ownership-contract.test.ts`
- `apps/pulse/tests/entrypoint-dead-end-probe.test.tsx`

2. Entrypoint analytics contract and hardening:
- `docs/phase14-2-entrypoint-analytics-contract.md`
- merged `#284` and `#285`

3. Route continuity guard in CI:
- merged `#286` (`pulse-route-gate` includes dead-end probe)

No new telemetry sources, runtime dashboards, or additional event types were introduced for this review.

## Findings

### F1. Journey coherence is structurally valid

Evidence:
- Dead-end probe confirms each entrypoint links to at least one other in-scope entrypoint.
- Strong connectivity assertion confirms every entrypoint can reach every other through allowed transitions.

Decision:
- Keep current route-level continuity graph.

### F2. Silent ownership transitions have been removed

Evidence:
- `/signup` is a visible bridge surface, not a silent redirect.
- Continuity links between `/demo`, `/ai-reliability-audit`, and `/signup` are explicit.

Decision:
- Keep explicit transition model.

### F3. Analytics contract is sufficient for continuity evidence

Evidence:
- Existing event set covers page view, primary CTA click, and continuity transition execution.
- 14.2b hardening covers Strict Mode duplicate suppression, adapter failure isolation, and route allowlist integrity.

Decision:
- No new instrumentation in Phase 15 unless an evidence gap is proven.

### F4. Current risk is CTA entropy, not missing routing

Evidence:
- Contract/tests prove route continuity.
- Remaining failure mode is future copy/link sprawl that weakens primary decision paths.

Decision:
- Treat additional CTA additions as exception-only changes requiring a dead-end/continuity rationale.

## Dead Weight / Confusion Review

Current assessment using existing tests/contracts:
- No hard dead-end surfaces remain in the public triad.
- No route-ownership ambiguity remains for `/demo`, `/ai-reliability-audit`, `/signup`.
- No immediate evidence of transition breakage.

What remains intentionally unclaimed:
- Conversion effectiveness (requires production analytics consumption, out of scope).
- Qualitative copy effectiveness (requires user research/revenue data, out of scope).

## Decisions

1. Close Phase 14 as complete (`14.2`, `14.2b`, `14.3` landed).
2. Do not execute speculative 14.1 hierarchy polish now.
3. Freeze Phase 15 to evidence review + decision logging unless concrete continuity failures are found.
4. Require any future public CTA changes to preserve:
- continuity graph coverage
- query-preserving conversion path behavior
- entrypoint analytics contract compatibility

## Allowed Next Work After This Review

Permitted without reopening instrumentation:
- copy clarifications that do not alter route contracts
- small CTA pruning only when justified by a specific confusion finding

Requires a new spec before implementation:
- new entrypoint events
- analytics dashboards/reporting layer
- hierarchy redesign or visual prominence retuning

## Validation

Document-only slice. No code path changes.

