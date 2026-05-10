# Pulse Phase 8 Decision Flow

## Purpose
Provide one canonical flow for closing the Phase 8 freeze gate.

## Flow
1. Complete technical checklist in `docs/pulse-phase8-closeout-checklist.md`.
2. Collect owner approvals in `docs/pulse-phase8-readiness-signoff-record.md`.
3. Set final outcome in sign-off record:
   - `approved`
   - `blocked`
4. Execute the matching path:
   - Approved path: `docs/pulse-phase8-approved-transition-template.md`
   - Blocked path: `docs/pulse-phase8-blocked-remediation-template.md`
5. Record closeout date and next slice owner.

## Hard Rule
No execution-capability code may begin unless the sign-off record outcome is `approved`.
