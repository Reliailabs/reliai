# Pulse Phase 9.1 — Evidence Receipt Model

## Requirement
Every assisted proposal emits an immutable evidence receipt.

## Minimum Fields
- receipt_id
- proposal_id
- actor_id (or system origin)
- action_class
- target
- evidence_refs
- policy_gate_result
- created_at

## Usage
Evidence receipts are the continuity layer between:
- Decision Reliability infrastructure
- audit/export workflows
- future certification posture
