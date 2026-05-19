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

## Review Hypotheses

H1. The public triad journey is operationally coherent:
- every entrypoint exposes at least one valid next step into another in-scope entrypoint.

H2. Continuity integrity is stable under current contracts:
- transition graph remains strongly connected and route ownership remains explicit.

H3. No additional instrumentation is required for continuity decisions:
- existing events and guards are enough to detect route-level journey breakage.

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

## Measurable Review Criteria

C1. Dead-end criterion:
- fail if any in-scope entrypoint has zero outgoing links to in-scope entrypoints.

C2. Connectivity criterion:
- fail if strong connectivity across `/`, `/demo`, `/ai-reliability-audit`, `/signup` is broken.

C3. Ownership criterion:
- fail if `/signup` reverts to silent redirect behavior or `/demo` ownership contract regresses.

C4. Contract criterion:
- fail if continuity behavior diverges from entrypoint analytics route/transition allowlists.

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

## Decision Thresholds

Revive 14.1 hierarchy hardening only when at least one threshold is hit:
- T1: dead-end criterion fails in CI.
- T2: connectivity criterion fails in CI.
- T3: ownership criterion fails in CI or route-contract review.
- T4: a continuity regression is reproduced in probe/tests and mapped to CTA hierarchy confusion.

Keep 14.1 deferred when all criteria pass:
- no dead-end failures
- no connectivity failures
- no ownership regressions
- no continuity regression repro tied to hierarchy

## Decisions

1. Close Phase 14 as complete (`14.2`, `14.2b`, `14.3` landed).
2. Do not execute speculative 14.1 hierarchy polish now.
3. Freeze Phase 15 to evidence review + decision logging unless concrete continuity failures are found.
4. Require any future public CTA changes to preserve:
- continuity graph coverage
- query-preserving conversion path behavior
- entrypoint analytics contract compatibility

5. Changes that alter CTA prominence, CTA count, or entrypoint transition intent are blocked unless:
- they include evidence tied to one of the Phase 15 failure thresholds
- they include updated continuity/contract tests where behavior changes

## Allowed Next Work After This Review

Permitted without reopening instrumentation:
- copy clarifications that do not alter route contracts
- small CTA pruning only when justified by a specific confusion finding

Requires a new spec before implementation:
- new entrypoint events
- analytics dashboards/reporting layer
- hierarchy redesign or visual prominence retuning

## Intentionally Ignored Signals (This Phase)

- aggregate conversion rate movement
- campaign/source attribution optimization
- marketing copy A/B performance
- dashboard-level funnel analytics

These are intentionally excluded to prevent speculative optimization before continuity integrity decisions.

## Prohibited Changes Without New Evidence

- adding new top-level public CTAs that modify transition intent
- increasing cross-link density between entrypoints without documented confusion evidence
- hierarchy/prominence retuning framed as “polish” without threshold-trigger evidence
- adding new analytics events for entrypoints without a proven continuity evidence gap

## Validation

Document-only slice. No code path changes.
