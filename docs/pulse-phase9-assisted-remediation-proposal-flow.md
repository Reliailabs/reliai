# Pulse Phase 9.1 — Assisted Remediation Proposal Flow

## Flow
1. Collect scoped incident/deployment/trace evidence.
2. Run policy + eligibility gates.
3. Generate remediation proposal (non-mutating).
4. Produce command/impact preview.
5. Require operator approval.
6. Emit immutable evidence receipt.

## Output Artifacts
- proposal object
- impact preview
- policy decision summary
- evidence receipt
