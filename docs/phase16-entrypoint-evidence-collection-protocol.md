# Phase 16 Entrypoint Evidence Collection Protocol

Status: Active
Owner: Pulse migration
Scope type: evidence operations only

## Purpose

Define exactly how to collect and evaluate Phase 16 evidence using existing entrypoint analytics contract output, without adding instrumentation, dashboards, or attribution expansion.

## Inputs

Required event types only:
- `entrypoint_page_viewed`
- `entrypoint_primary_cta_clicked`
- `entrypoint_continuity_transition_executed`

Required route scope only:
- `/`
- `/demo`
- `/ai-reliability-audit`
- `/signup`

Contract references:
- `docs/phase14-2-entrypoint-analytics-contract.md`
- `docs/phase15-entrypoint-evidence-review.md`
- `docs/phase16-entrypoint-evidence-consumption.md`

## Data Window Rules

1. Window length must be at least 14 consecutive days.
2. Window boundaries must be fixed before analysis starts.
3. Re-opened windows must be versioned (`cycle1-v2`, `cycle2-v1`, etc.).

## Data Extraction Rules

1. Extract raw event rows for in-scope event names only.
2. Drop events outside the four in-scope routes.
3. Keep source fields as captured; do not derive new attribution dimensions.
4. Preserve event timestamps in UTC and report evaluation window timezone separately.

## Normalized Evidence Shape

Each row must normalize to:
- `event_name`
- `event_time_utc`
- `route` (or `from_route` + `to_route`)
- `cta_id` (if present)
- `destination` (if present)
- `source_route` (if present)
- `utm_source` (optional passthrough)
- `utm_medium` (optional passthrough)
- `utm_campaign` (optional passthrough)

No additional inferred fields are allowed in Phase 16 outputs.

## Quality Checks

Mark the cycle `insufficient_evidence` if any fail:

1. Missing required event names for route continuity evaluation.
2. Invalid route values outside allowed set.
3. Missing timestamps for a material subset of events.
4. Window does not satisfy minimum duration.
5. Event counts do not meet Phase 16 minimum thresholds.

## Threshold Evaluation Procedure

Evaluate in this order:

1. Observation-window validity.
2. Global volume minimums.
3. Per-route minimums.
4. Continuity transition coverage across expected route pairs.
5. Phase 15 threshold conditions.

If any step fails, stop and classify `insufficient_evidence` or `failed_threshold` accordingly.

## Output Requirements

Each cycle output must include:
- explicit pass/fail for each threshold check
- route-level counts
- transition-level counts
- confidence classification (`high`, `medium`, `low`, `insufficient_evidence`)
- final decision (`keep`, `targeted_change`, `insufficient_evidence`)

Use:
- `docs/phase16-entrypoint-evidence-decision-template.md`

## Non-Goals Enforcement

This protocol explicitly forbids introducing:
- new event types
- funnel model expansion
- dashboard implementation
- attribution enrichment
- UI hierarchy changes during evidence collection

## Validation

Document-only slice.

