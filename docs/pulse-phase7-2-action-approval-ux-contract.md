# Pulse Phase 7.2 — Action Approval UX Contract (Planning-Only)

## Status
Planning only. No execution wiring.

## Objective
Define operator confirmation UX and audit requirements for controlled actions proposed in Phase 7.1.

## Hard Rule
No silent action. No mutation is allowed without explicit operator confirmation.

## Covered Action Types
- `ack`
- `assign`
- `open_remediation_task`
- `propose_guardrail`

## Approval UX Contract

### 1. Proposal Presentation
Each proposal card must include:
- action type
- target + scope
- concise rationale
- confidence
- evidence references
- explicit note: `Advisory intelligence only. Requires operator review.`

### 2. Confirmation Step (Required)
Any action transition from proposal -> approved must require:
- explicit confirm click
- actor identity capture
- timestamp
- immutable approval record id

No keyboard shortcut or bulk action may bypass this.

### 3. Rejection Step (Required)
Rejection must support:
- reject action
- optional reason (recommended)
- immutable rejection record id
- actor identity + timestamp

### 4. No Silent Action Rule
Forbidden behaviors:
- auto-approve
- auto-assign
- auto-ack
- auto-create remediation task
- auto-apply guardrail

### 5. State Model (Planning)
```ts
 type ControlledActionState =
  | "proposed"
  | "approved"
  | "rejected"
  | "expired";
```

Rules:
- initial state must be `proposed`
- only operator-initiated transition can move to `approved` or `rejected`
- `expired` may occur by policy timeout (documented, auditable)

### 6. Required Event Audit Fields
For every approval/rejection event:
- `event_id`
- `proposal_id`
- `action_type`
- `target_type`
- `target_id`
- `decision` (`approved` | `rejected`)
- `actor_user_id`
- `actor_role`
- `reason` (nullable)
- `evidence_refs`
- `created_at`

## UX Guardrails
- Keep approval UX compact and high-signal.
- Never imply deterministic causation.
- Never imply autonomous execution.
- Preserve confidence + evidence context at approval time.

## Output for Slice 7.3
This contract feeds the event-log schema and retention/audit requirements in Phase 7.3.

## Explicit Non-Goals
- no backend execution handlers
- no queue/workflow engine
- no mutation endpoints
- no RBAC implementation changes in this slice
