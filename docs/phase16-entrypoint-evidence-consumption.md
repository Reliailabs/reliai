# Phase 16: Entrypoint Evidence Consumption

Status: Planned
Owner: Pulse migration
Scope type: evaluation only

## Purpose

Evaluate public entrypoint behavior using existing instrumentation and continuity contracts, then produce explicit keep/change/remove decisions.

In-scope routes:
- `/`
- `/demo`
- `/ai-reliability-audit`
- `/signup`

## Hard Boundaries

- Phase 16 is an evaluation phase, not a dashboard phase.
- Existing event streams are treated as sufficient unless a Phase 15 threshold cannot be evaluated.
- No CTA or hierarchy changes occur during evidence collection.
- Any proposed UI change must map to at least one failed Phase 15 threshold.

## Required Inputs

Use existing sources only:
- Phase 14 entrypoint analytics contract output (`entrypoint_page_viewed`, `entrypoint_primary_cta_clicked`, `entrypoint_continuity_transition_executed`)
- Phase 14.3 continuity CI signal (`entrypoint-dead-end-probe`)
- Phase 15 decision thresholds and prohibited-change rules

No additional instrumentation is allowed by default.

## Decision Framework

### Observation Window

Minimum window for a valid decision cycle:
- at least 14 consecutive days of captured entrypoint events

### Minimum Event Volume

Minimum volume before conclusions are treated as actionable:
- at least 500 `entrypoint_page_viewed` events total
- at least 100 continuity transition events total
- at least 30 events per in-scope route

If minimums are not met, result is `insufficient_evidence`.

### Confidence Limitations

Phase 16 does not claim:
- causal conversion uplift
- campaign/source attribution performance
- copy-performance superiority between wording variants

Phase 16 only supports continuity and navigation integrity decisions within the existing contract boundaries.

### Insufficient Evidence Conditions

Mark decisions as `insufficient_evidence` when any apply:
- observation window incomplete
- event volume below minimum thresholds
- missing route coverage (one or more routes below minimum)
- event quality defects that prevent threshold evaluation

## Evaluation Criteria

For each route and route-to-route path, evaluate:
- continuity reachability using event flow evidence
- dead-end risk (behavioral evidence vs contract assertions)
- transition clarity (high abandonment at specific transition steps)
- ownership continuity behavior consistency

## Output Contract

Phase 16 must produce one decision artifact containing:
- evidence summary
- per-route assessment
- per-transition assessment
- explicit decisions:
  - `keep` (no changes)
  - `change` (targeted change request linked to failed threshold)
  - `remove` (unsupported/unused transition proposal)
- confidence level (`high`, `medium`, `low`, `insufficient_evidence`)
- unresolved questions and data limits

## Change-Admissibility Rule

No UI/CTA/hierarchy proposal is admissible unless it includes:
1. failed Phase 15 threshold reference
2. route or transition evidence excerpt
3. minimal change proposal scoped to the failed threshold
4. validation plan for continuity contracts after change

## Non-Goals

Explicitly out of scope for Phase 16:
- funnel optimization work
- A/B testing infrastructure
- marketing attribution expansion
- generalized analytics dashboards

## Exit Criteria

Phase 16 closes when:
- observation window and minimum volume are satisfied OR `insufficient_evidence` is formally declared
- a decision artifact is published with explicit keep/change/remove outcomes
- any proposed follow-up changes are threshold-linked and narrowly scoped

## Cycle Artifacts

- Cycle 0 decision record: `docs/phase16-entrypoint-evidence-review-cycle0.md`
- Evidence collection protocol: `docs/phase16-entrypoint-evidence-collection-protocol.md`

## Validation

Document-only spec slice.
