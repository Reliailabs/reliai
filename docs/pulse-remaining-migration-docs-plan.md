# Pulse Remaining Migration Docs Plan (Post-M5 through Completion)

## Purpose
Close remaining migration documentation so Phase 9+ work stays gated behind parity classification.

## Remaining Doc Slices

### M6 — Settings/Onboarding/Billing/Docs/Playground Portability Plan
Required doc:
- `docs/pulse-m6-settings-onboarding-portability-plan.md`

Must include:
- exact source routes
- migrate vs stay-in-web decisions
- auth/public boundary rules
- parity status targets

### M7 — Deferred Project Subroutes Parity Plan
Required doc:
- `docs/pulse-m7-project-deferred-routes-plan.md`

Covers:
- ingestion
- processors
- regressions
- reliability

### M8 — Migration Completion Gate
Required doc:
- `docs/pulse-migration-completion-gate.md`

Must define:
- final parity checklist
- unresolved `Partial` blockers
- explicit net-new unlock criteria

### M9 — Source-of-Truth Drift Audit Template
Required doc:
- `docs/pulse-source-truth-drift-audit-template.md`

Must define:
- how every new slice proves contract alignment with `apps/web`
- required PR statement fields

## Required PR Statement (for all future migration PRs)
- Classification: `Migration` | `Net-new` | `UI-only reference` | `Deprecated / do not migrate`
- Net-new behavior added: `Yes/No`
- Source-of-truth validated against: file paths

## Unlock Rule
No net-new capability work proceeds until:
1. Migration audit matrix is current.
2. Route group parity for active slice is classified.
3. PR includes source-of-truth validation statement.

## Done Condition (Docs Completion)
- M5/M6/M7/M8/M9 docs exist.
- `docs/pulse-migration-audit-sheet.md` links to all plans.
- Phase 9 docs reference migration completion gate.
