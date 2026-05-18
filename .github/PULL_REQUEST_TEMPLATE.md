## What changed

<!-- Concisely describe what was implemented -->

## Why it changed

<!-- Product, reliability, UX, or operational reason -->

## How it was validated

<!-- List exact commands run and summarize results -->

- [ ] Relevant backend tests
- [ ] `pnpm --filter web lint`
- [ ] `pnpm --filter web build`
- [ ] Browser/manual sanity pass (if relevant)

## Risk / rollback note

<!-- Main risk and how to revert or isolate the change if needed -->

## Phase12 Follow-up Contract (required for `P12.x` slices)

<!-- Remove this section only when PR scope is not a Phase 12 follow-up. -->

- [ ] Not applicable (this PR is not `P12.x`)
- `slice_id`: `P12.x`
- `scope`: `<contract-only | presenter-consumption-only | docs-only | ...>`
- `routes_touched`: `</demo | /ai-reliability-audit | /signup | none>`
- `invariants_touched`:
  - deterministic replay
  - no presenter reinterpretation
  - contract-owned decision semantics
  - CTA label/destination alignment
  - no live provider runtime dependency
- `validation`:
  - `pnpm --filter pulse test:phase12-route-ownership-gate`
  - `<additional targeted checks>`
- `ci_proof`: `<link to successful pulse-route-gate run>`
- `check_query_evidence`: `<output snapshot from gh pr view ... statusCheckRollup OR pnpm pr:wait-required-checks -- <PR#> pulse-route-gate operator-smoke>`
- `risk_rollback`: `<one line>`

## Checklist

- [ ] Branch is scoped to one change
- [ ] No unrelated dirty files
- [ ] Copy matches actual implementation
- [ ] Changelog updated if meaningful
- [ ] No debug logs / throwaway files left behind
