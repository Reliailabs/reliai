# Audit Report Polish, Traceability, and Run History Design

## Goal

Tighten the current audit product in three narrow areas without expanding architecture:

1. improve report quality
2. improve evidence-to-finding traceability
3. add lightweight run history visibility on `/audits/[id]`

This pass must keep the product serious, operational, and release-grade. It must not add worker queues, a policy-management UI, or a large run-history experience.

## Scope

### In scope

- Internal threshold configuration cleanup for certification-at-risk logic
- Shared report narrative structure for UI results and generated report artifacts
- Better finding presentation with clearer evidence and surface linkage
- Compact previous-runs panel showing up to 6 runs, newest first

### Out of scope

- New queueing architecture
- Large run-history routes or comparison flows
- User-facing threshold management
- Major audit-system redesign

## Current constraints

- `apps/api/app/services/audits.py` already owns results assembly, run lifecycle, and artifact generation
- `apps/web/app/(app)/audits/[id]/page.tsx` is the current audit detail page
- `apps/web/app/(app)/audits/[id]/results/page.tsx` is the current results page
- `list_audit_runs(...)` already exists server-side, so lightweight history can reuse existing backend patterns

## Design

## 1. Threshold configuration cleanup

Introduce a small internal configuration module, likely `apps/api/app/services/audit_thresholds.py`, to remove magic numbers and make threshold reasoning explicit.

The module will define:

- a `ThresholdContext` shape based on current available inputs:
  - `audit_type`
  - `policy_profile`
  - `environment`
  - optional `project_criticality` slot for future use
- a `ThresholdPolicy` structure holding conservative defaults and explainable rule text
- helper functions that return:
  - the active threshold policy for a context
  - the reasons that caused certification-at-risk evaluation

This pass will not add per-customer tuning or a UI. It will keep current conservative behavior while making future variation by audit type, policy profile, project criticality, or environment straightforward.

## 2. Shared report narrative structure

Create a small report-formatting layer in the audit service path so both the UI results payload and generated artifacts follow the same structure.

The shared narrative will lead with:

- certification decision
- risk level
- blocker status
- required next action

It will also include:

- top blockers
- required remediation
- recommended improvements
- evidence impact summary
- next-step guidance

The language should stay concise and evidence-driven. It should read like an operational decision artifact, not like consultant filler.

Generated artifacts should continue using existing artifact types:

- `executive_report`
- `certification_report`
- `evidence_bundle`

But their `metadata_json` should become more structured and useful for rendering and downstream trust.

## 3. Evidence-to-finding traceability

Improve results data and UI presentation so each important finding answers:

- what is wrong
- what evidence supports it
- what surface is affected
- why it matters

Implementation approach:

- derive a compact evidence-link summary from existing finding fields plus production snapshot metadata
- surface human-readable evidence references instead of raw internal identifiers
- derive affected surface from `recommended_scope`, `evidence_ref`, or snapshot context when available
- keep confidence and validation visible but secondary

The results page should move away from a raw table feel toward compact finding cards or rows with clear hierarchy. This should improve demos and operator trust without turning the page into a forensic console.

## 4. Lightweight previous-runs panel

Extend the audit detail response to include recent runs, newest first, limited to 6.

The `/audits/[id]` page will show a compact secondary panel listing all recent runs within that limit. Each row will show:

- created date
- completed date, if present
- run status
- certification status
- risk score, if available

It will also add simple labels for:

- current run
- latest completed
- pending / in progress

The panel will not add deep history, pagination, a new route, or run-to-run comparison.

## Data flow

1. Audit services compute current run results and fetch recent runs
2. Threshold helpers provide explainable policy details for current evaluation
3. Report formatter produces structured decision/remediation/evidence summary blocks
4. Results page renders the shared narrative and traceable findings
5. Audit detail page renders compact run history under the current audit view

## Error handling

- If no production snapshot exists, report sections should explicitly say production evidence was not included
- If no completed prior runs exist, previous-runs panel still shows pending/current runs when present
- If risk score is unavailable, UI should show a neutral placeholder rather than implying certainty

## Testing

Backend:

- add or update audit service tests for:
  - threshold policy selection / explainable reasons
  - report artifact metadata structure
  - recent-runs payload inclusion
  - evidence traceability summaries where practical

Frontend:

- rely on existing typed page rendering plus required `pnpm --filter web lint` and `pnpm --filter web build`
- keep UI changes incremental and type-safe

## Risks and limitations

- Thresholds remain global defaults in this pass; the design only makes them easier to evolve
- Run history remains lightweight and secondary; it is not a dedicated operational timeline
- Evidence traceability will improve operator understanding, but it will still be summarized rather than exhaustively forensic

## Implementation sequence

1. add threshold configuration helper module
2. improve results/report assembly in audit services
3. expose recent runs in audit detail response
4. update results page hierarchy and finding traceability
5. add compact previous-runs panel to audit detail page
6. run backend tests, web lint, and web build
