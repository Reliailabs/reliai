# Pulse Phase 9.4 — Automation Auditability and Kill-Switch Contract

## Status
Implemented. Runtime mapping below.

## Runtime Mapping

| Contract item | Implementation |
|---|---|
| Audit event: actor, suggestion, evidence, decision, outcome, timestamps | `validateAutomationAuditEvent()` — Zod schema + timestamp ordering + evidence href guard |
| decided_at must not precede proposed_at | Validated in `validateAutomationAuditEvent()` |
| Global kill-switch (org scope) | `validateKillSwitchPolicy()` — `global_kill_switch_active: true` blocks all surfaces |
| Per-surface kill-switch (incidents/deployments/guardrails) | `surface_kill_switches[target_surface]` check |
| Existing staged proposals marked `disabled_by_policy` | `disabled_proposal_ids` returned when kill-switch active |
| Observability payload: decision outcomes, block reasons, override frequency | `validateObservabilityPayload()` — schema + window ordering + threshold warnings |
| High override frequency warning (>50%) | Warning emitted at `operator_override_frequency > 0.5` |

## Entry Points

- `POST /api/actions/assisted-automation/audit/validate` — validate an automation audit event
- `POST /api/actions/assisted-automation/kill-switch/validate` — validate kill-switch policy state
- `POST /api/actions/assisted-automation/observability/validate` — validate observability dashboard payload

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
