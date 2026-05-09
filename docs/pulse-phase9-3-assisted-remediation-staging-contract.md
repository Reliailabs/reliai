# Pulse Phase 9.3 — Assisted Remediation Staging Contract

## Status
Planning-only contract.

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
