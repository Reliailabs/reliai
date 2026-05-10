# Pulse Migration Gate Sign-Off Template

Date: YYYY-MM-DD
Owner: 
Reviewer(s): 

## Gate Decision
- Result: `PASS` | `FAIL`
- Scope: `Migration`
- Net-new behavior included: `No`
- Source-of-truth baseline: `apps/web`

## Checklist
- [ ] `docs/pulse-migration-audit-sheet.md` is up to date
- [ ] M5 closure audit reviewed (`docs/pulse-m5-4-project-parity-closure-audit.md`)
- [ ] M6 portability audit reviewed (`docs/pulse-m6-portability-classification-audit.md`)
- [ ] M7 deferred routes audit reviewed (`docs/pulse-m7-deferred-project-routes-audit.md`)
- [ ] Remaining migration gaps are explicitly documented and approved
- [ ] Every migration PR includes:
  - classification
  - net-new behavior statement
  - source-of-truth validation statement
- [ ] No hidden net-new capability in migration slices
- [ ] Auth/route parity stable for migrated surfaces

## Parity Summary
- Incidents deep links: 
- Audits detail/results/new: 
- Traces detail routes: 
- Deployments detail: 
- Project-scoped routes: 
- Settings/onboarding portability: 

## Open Blockers (if any)
1. 
2. 
3. 

## Deferred Items (approved)
- 
- 

## Phase 9 Impact
- Status: `Blocked` | `Unblocked`
- Rationale:

## Approval
- Migration gate approved by:
- Signature/date:

## Notes
- This sign-off is required before new net-new capability implementation proceeds beyond approved migration boundaries.
