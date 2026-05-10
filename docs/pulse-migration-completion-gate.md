# Pulse Migration Completion Gate

## Purpose
Define the hard gate to mark source migration complete before net-new capability expansion.

## Required checks
1. Audit matrix current and reviewed.
2. Priority migration groups status:
   - Incidents deep links: at least Partial with no dead links
   - Audits detail/results/new: at least Partial
   - Traces detail routes: at least Partial
   - Deployments detail: at least Partial
   - Project-scoped routes: M5 route set classified
   - Settings/onboarding portability: M6 decisions documented
3. No PR missing classification/source-of-truth statement.
4. No unresolved auth/role guard drift on migrated routes.

## Unlock condition for net-new
- Either full `Parity reached` for active target group, or
- explicit approval for `Net-new` with migration impact note.


## Sign-Off Artifact
- Sign-off template: `docs/pulse-migration-gate-signoff-template.md`
