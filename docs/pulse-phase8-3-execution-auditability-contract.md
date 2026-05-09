# Pulse Phase 8.3 — Execution Auditability Contract

## Status
Planning-only auditability definition.

## Objective
Standardize immutable execution records for all controlled actions.

## Hard Boundary
Every execution attempt must be audit-logged, including blocked/failed attempts.

## Canonical Event Schema
```ts
type ExecutionAuditEvent = {
  event_id: string;
  execution_id: string;
  proposal_id: string;
  action_type: string;
  actor_user_id: string;
  actor_role: string;
  target_type: string;
  target_id: string;
  reason: string;
  evidence_refs: Array<{ label: string; href: string }>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  result: "succeeded" | "failed" | "blocked";
  error_code: string | null;
  created_at: string;
};
```

## Retention and Immutability
- Events are append-only.
- No destructive edits.
- Corrections are recorded as new events referencing prior event IDs.

## Reviewability
Operators and auditors must be able to answer:
- Who executed what?
- Why was it executed?
- What evidence was used?
- What changed?
- Was the action reversible?

## Non-Goals
- No external SIEM integration in this slice.
- No event stream architecture changes.
