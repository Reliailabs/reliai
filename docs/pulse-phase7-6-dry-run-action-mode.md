# Pulse Phase 7.6 — Dry-Run Action Mode (Design-Only)

## Status
Planning/design only. No execution implementation.

## Objective
Define simulation-only operator flow for controlled actions before any real mutation is allowed.

## Hard Boundary
Dry-run mode must not mutate incident, deployment, guardrail, certification, or ownership state.

## Dry-Run Contract
```ts
type DryRunResult = {
  proposal_id: string;
  action_type: string;
  simulated_outcome: "would_pass" | "would_block" | "insufficient_data";
  precondition_results: Array<{
    check_id: string;
    status: "pass" | "fail" | "warn";
    detail: string;
  }>;
  evidence_refs: Array<{ label: string; href: string }>;
  requires_operator_review: true;
  generated_at: string;
};
```

## UX Expectations (Planning)
- “Run dry-run” action available on proposals.
- Result must show clear pass/fail reasons.
- Result must include evidence references used for simulation.
- Result must include explicit note: simulation only, no state change performed.

## Failure Modes to Surface
- insufficient evidence
- permission denied (by role/scope)
- stale/missing target
- policy precondition failure

## Output for Slice 7.7
Feeds Phase 7 entry gate criteria and readiness scoring.

## Explicit Non-Goals
- no execution endpoint
- no background job orchestration
- no automatic action apply
