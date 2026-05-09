# Pulse Phase 9.2 — Assisted Incident Automation Contract

## Status
Planning-only contract.

## Objective
Define bounded assisted automation for incident workflows without autonomous resolution.

## Allowed Assisted Actions
- Auto-draft incident notes from linked evidence.
- Auto-suggest assignee candidates (no assignment mutation).
- Auto-stage escalation recommendation (operator confirms).
- Auto-open related investigation links (read-only).

## Required Constraints
- Every suggestion must cite evidence references.
- Suggestions must include confidence + "Requires operator review".
- No automatic incident status transition.
- No severity mutation without explicit approval flow.

## Operator Interaction
- Operator can accept/reject each suggestion independently.
- Rejections are logged with reason to improve future policy tuning.

## Non-Goals
- No autonomous incident closure.
- No automatic paging execution.
