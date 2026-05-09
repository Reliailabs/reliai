# Pulse Phase 9.4 — Automation Auditability and Kill-Switch Contract

## Status
Planning-only safety contract.

## Objective
Define auditability and emergency control requirements for assisted automation.

## Auditability Requirements
Every assisted automation event logs:
- actor (human/system)
- suggestion generated
- evidence basis
- operator decision
- outcome/status
- timestamps

## Kill-Switch Requirements
- Global automation kill-switch (org scope).
- Per-surface kill-switch (`incidents`, `deployments`, `guardrails`).
- Immediate effect on new automation proposals.
- Existing staged proposals marked `disabled_by_policy`.

## Observability Requirements
- Dashboard panel showing automation decision outcomes.
- Failure and block reason distributions.
- Operator override frequency.

## Non-Goals
- No kill-switch implementation in this slice.
- No new orchestration runtime.
