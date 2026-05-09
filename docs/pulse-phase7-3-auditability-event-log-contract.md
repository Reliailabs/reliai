# Pulse Phase 7.3 — Auditability / Event Log Contract (Planning-Only)

## Status
Planning only. No execution wiring.

## Objective
Standardize immutable event logging for controlled action proposals and decisions.

## Hard Boundary
No action execution in this slice. This is schema/contract definition only.

## Event Schema (Canonical)
```ts
type ControlledActionEvent = {
  event_id: string;
  proposal_id: string;
  action_type: "ack" | "assign" | "open_remediation_task" | "propose_guardrail";
  target_type: "incident" | "deployment" | "trace_group" | "guardrail_policy";
  target_id: string;
  decision: "proposed" | "approved" | "rejected" | "expired";
  actor_user_id: string | null;
  actor_role: string | null;
  reason: string | null;
  evidence_refs: Array<{ label: string; href: string }>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  request_context: {
    organization_id: string;
    project_id: string | null;
    environment_id: string | null;
    source_surface: "pulse" | "incidents" | "errors" | "traces" | "deployments";
  };
  created_at: string;
};
```

## Logging Rules
1. Append-only event stream; no in-place mutation of historical events.
2. Every state transition emits an event.
3. `before_state`/`after_state` required for approve/reject/expire transitions.
4. Evidence references captured at decision time (snapshot of links used by operator).
5. Event timestamps must be server-generated.

## Integrity Rules
- `event_id` and `proposal_id` must be stable UUIDs.
- Decision progression must be monotonic for a proposal:
  - `proposed` -> (`approved` | `rejected` | `expired`)
- No duplicate terminal decisions for the same proposal.

## Retention + Access (Planning)
- Retain events for audit horizon (policy-defined; suggested minimum 12 months).
- Events are org-scoped; cross-tenant reads forbidden.
- Read access is role-filtered and auditable.

## Derived Views
Planning-only views derived from event stream:
- proposal timeline
- actor decision history
- evidence lineage
- decision latency metrics

## Output for Slice 7.4
Feeds RBAC matrix and permission checks for action approvals.

## Explicit Non-Goals
- no event-processing workers
- no queue/orchestration runtime
- no automatic remediation
- no mutation endpoints
