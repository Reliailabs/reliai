# Pulse Phase 8.1 — Controlled Execution Contract Spec

## Status
Planning-only contract definition for supervised execution.

## Objective
Define the first execution contract for human-approved, auditable, reversible actions.

## Hard Boundary
No autonomous execution. Every execution requires explicit operator approval bound to an approved proposal.

## Execution Eligibility
An action is executable only if all are true:
1. Proposal state is `approved`.
2. Approval actor + timestamp are present.
3. Evidence references are present and valid.
4. RBAC scope check passes.
5. Safety/policy preconditions pass.
6. Target resource exists and is mutable.

## Canonical Contract
```ts
type ControlledExecutionRequest = {
  execution_id: string;
  proposal_id: string;
  action_type: "ack" | "assign" | "open_remediation_task" | "propose_guardrail" | "rollback";
  target_type: "incident" | "deployment" | "trace_group" | "guardrail_policy";
  target_id: string;
  approved_by_user_id: string;
  approved_at: string;
  evidence_refs: Array<{ label: string; href: string }>;
  dry_run_result_id: string | null;
  request_context: {
    organization_id: string;
    project_id: string | null;
    environment_id: string | null;
  };
};
```

## Execution Result Contract
```ts
type ControlledExecutionResult = {
  execution_id: string;
  proposal_id: string;
  status: "succeeded" | "failed" | "blocked";
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reversible: boolean;
  rollback_reference: string | null;
  message: string;
  created_at: string;
};
```

## Reversibility Rules
- Any mutable execution must declare reversibility.
- If non-reversible, system must show explicit warning before execution confirmation.
- Rollback references must be captured when available.

## Audit Requirements
Every execution attempt logs:
- who approved
- what executed
- why (proposal rationale)
- evidence used
- before/after state
- result status and failure reason

## Non-Goals
- No execution runtime implementation in this slice.
- No queue/orchestration engine changes.
- No autonomous retries or automation.
