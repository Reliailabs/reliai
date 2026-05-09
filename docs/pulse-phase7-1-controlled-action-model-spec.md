# Pulse Phase 7.1 — Controlled Action Model Spec (Planning-Only)

## Status
Planning only. No execution wiring.

## Objective
Define operator-confirmed action contracts that can be reviewed, approved, and audited before any Phase 8 execution work.

## Hard Boundary
Phase 7.1 must not execute, mutate, rollback, auto-assign, or change severity/certification state.

## Action Types (non-executing proposals)
1. `ack`
2. `assign`
3. `open_remediation_task`
4. `propose_guardrail`

## Canonical Action Contract
```ts
type ControlledActionProposal = {
  id: string;
  action_type: "ack" | "assign" | "open_remediation_task" | "propose_guardrail";
  target_type: "incident" | "deployment" | "trace_group" | "guardrail_policy";
  target_id: string;
  summary: string;
  rationale: string;
  evidence_refs: Array<{ label: string; href: string }>;
  confidence: "insufficient" | "low" | "medium" | "high";
  requires_operator_review: true;
  requested_by: string;
  requested_at: string;
};
```

## Contract Rules
1. Proposal-only in Phase 7.1; no side effects.
2. Every proposal must include at least one `evidence_ref`, otherwise mark confidence `insufficient`.
3. No proposal can imply autonomous execution language.
4. Every proposal includes `requires_operator_review: true`.

## Per-Action Expectations
### `ack`
- Suggest acknowledgment target and why.
- No status change in Phase 7.1.

### `assign`
- Suggest owner candidate and why.
- No owner mutation in Phase 7.1.

### `open_remediation_task`
- Suggest task payload and linked evidence.
- No ticket creation in Phase 7.1.

### `propose_guardrail`
- Suggest guardrail type/config direction and evidence.
- No policy creation/update in Phase 7.1.

## Outputs for Next Slices
- Input to Slice 7.2 Approval UX contract.
- Input to Slice 7.3 event/audit schema.
- Input to Slice 7.4 RBAC guardrails matrix.

## Explicit Non-Goals
- No orchestration.
- No automation.
- No RBAC mutation implementation.
- No backend schema changes.
