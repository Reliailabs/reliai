# Pulse Phase 8.4 — Rollback and Reversibility Contract

## Status
Planning-only rollback safety contract.

## Objective
Define preconditions and constraints for supervised rollback execution.

## Hard Boundary
Rollback remains operator-approved only and must pass explicit safety checks.

## Preconditions
Rollback can proceed only when all are true:
1. Deployment evidence link exists.
2. Incident/regression evidence is within configured evidence window.
3. Rollback target version is known and valid.
4. Approval actor has rollback permissions.
5. Guardrail policy check does not block rollback.

## Required Warnings
- "Rollback may impact active traffic."
- "Requires operator review and confirmation."
- "No automatic certification mutation is performed."

## Failure Modes
- `blocked_missing_evidence`
- `blocked_missing_target_version`
- `blocked_policy_violation`
- `failed_execution`

## Post-Execution Requirements
- Capture before/after state.
- Link resulting execution event to incident/deployment records.
- Record whether action was reversible.

## Non-Goals
- No autonomous rollback.
- No multi-step orchestration workflows.
