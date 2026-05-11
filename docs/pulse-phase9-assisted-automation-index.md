# Pulse Phase 9 — Assisted Automation Index

## Purpose
Define the planning-only scope for assisted automation after supervised execution controls are proven.

## Phase 8 Anchor (Required)
Phase 9 starts only after Phase 8 closure approval:
- Phase 8 closeout approval PR: `#124`
- Sign-off record: `docs/pulse-phase8-readiness-signoff-record.md`
- Freeze status: `docs/pulse-phase8-freeze-status.md`

## Positioning
Reliai Phase 9 is a **Controlled Operational Decision System** layer.
It is not autonomous operations and not direct AI action authority.

## Vocabulary (Normative)
- **Assisted Automation**: system-generated proposals and staged actions requiring operator confirmation.
- **Proposal**: immutable remediation suggestion bound to evidence refs and policy gates.
- **Staging**: non-mutating preview of steps/impact/constraints.
- **Execution Eligibility**: policy + evidence + tenancy + safety checks passed.
- **Evidence Receipt**: immutable action artifact linking who/what/why/evidence/outcome.

## Preconditions
Phase 9 planning assumes:
- Phase 8 supervised execution contracts are accepted.
- Governance boundary audits show no policy regressions.
- Operator trust/false-positive thresholds meet entry criteria.

## Hard Boundary
Automation in Phase 9 is **assisted and bounded**. It must remain observable, reversible where possible, and policy-constrained.

## Slice Index
- 9.1 Automation Eligibility and Policy Gate — Implemented (PR #141)
- 9.2 Assisted Incident Automation Contract — Implemented (PR #142)
- 9.3 Assisted Remediation Staging Contract — Implemented (PR #143)
- 9.4 Automation Auditability and Kill-Switch Contract — Implemented (PR #143)
- 9.5 Remediation Proposal Completion — Implemented (PR #144)

## Phase 9.1 Kickoff Docs
- `docs/pulse-phase9-policy-gate-contract.md`
- `docs/pulse-phase9-runtime-safety-boundaries.md`
- `docs/pulse-phase9-assisted-remediation-proposal-flow.md`
- `docs/pulse-phase9-operator-confirmation-requirements.md`
- `docs/pulse-phase9-evidence-receipt-model.md`
- `docs/pulse-phase9-pilot-surface-incident-assist.md`

## Kickoff Spec Gap — Closed (PR #144)
The six Phase 9.1 kickoff docs specified a full proposal pipeline (evidence → policy gates →
proposal → impact preview → operator confirmation → evidence receipt) that was partially
unimplemented after slices 9.1–9.4. Phase 9.5 closes that gap:
- `buildImpactPreview()` — blast radius, reversibility, policy gate summary
- `validateOperatorConfirmation()` — mandatory fields, no implicit approval, expiry guard, policy-denied block
- `emitEvidenceReceipt()` — deterministic receipt_id, all 8 spec fields, immutable flag

All three are validation-only. No execution, no persistence, no mutation.

## Explicit Non-Goals
- No autonomous production mutation by default.
- No silent rollback execution.
- No automatic severity or certification mutation.
- No cross-tenant automation fan-out.

## Exit Criteria to Phase 10+
- Measured false-positive bounds across assisted flows.
- Proven rollback/undo reliability for staged actions.
- Governance sign-off on policy enforcement and auditability.
