# Pulse Phase 9.3 — Assisted Remediation Staging Contract

## Status
Implemented. Runtime mapping below.

## Runtime Mapping

| Contract item | Implementation |
|---|---|
| Rollback candidate command set | `step_type: "rollback_candidate_command_set"` |
| Guardrail update proposal | `step_type: "guardrail_update_proposal"` |
| Remediation task draft | `step_type: "remediation_task_draft"` |
| TTL enforcement (15 min) | `staged_at` validated against `Date.now()` in `stageRemediationStep()` |
| Environment mismatch invalidation | `staged_environment_id !== active_environment_id` → rejected |
| Evidence refs required | Zod schema `evidence_refs` min 1 + internal-href guard |
| Required staging metadata | `expected_effect`, `reversibility_note`, `risk_flags`, `approval_requirements` |
| Risk flag warnings | Non-empty `risk_flags` → warning in response |
| Approval requirement warnings | Non-empty `approval_requirements` → warning in response |
| No execution / mutation / persistence | Validated by test: output contains no `executed`, `applied`, `persisted`, `approved` fields |

## Entry Point

- `POST /api/actions/assisted-automation/remediation/stage` — validate and stage a remediation step (validation-only)

## Objective
Define staging-only remediation steps before any mutating execution.

## Staging Scope
- Prepare rollback candidate command set (not executed).
- Prepare guardrail update proposal payload (not applied).
- Prepare remediation task draft with linked evidence.

## Required Staging Metadata
- evidence_refs
- expected_effect
- reversibility_note
- risk_flags
- approval_requirements

## Safety Rules
- Staged steps expire after a short TTL.
- Staged actions cannot auto-promote to executed.
- Any environment mismatch invalidates the staged action.

## Non-Goals
- No direct rollout gate enforcement.
- No background remediation execution.
