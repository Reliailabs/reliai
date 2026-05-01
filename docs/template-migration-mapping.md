# Template Migration Mapping Notes

Date: 2026-05-01

## Source Templates
- `pulse/`: visual/operator dashboard template baseline
- `linear/`: Sprint-style marketing rhythm baseline

## Migration Rules Applied
- Pulse template influences visual system only (layout, density, card hierarchy).
- Linear/Sprint template influences marketing rhythm/motion only.
- No infra-first labels as product truth (SLA/on-call/services/uptime/system overview).
- No PM/productivity language in marketing surfaces.
- Claims tied to Reliai product surfaces only: AREI, incidents, traces, regressions, timeline, guardrails, audit readiness.

## Current Status
- `apps/web` homepage uses Reliai copy and maps CTAs correctly:
  - Primary: `/ai-reliability-audit`
  - Secondary label: `View Pulse dashboard` -> `/demo`
  - Visual label: `Pulse dashboard preview`
- `app/dashboard-v1` `/pulse` retains Reliai decision-surface semantics and explicit live/demo labeling.

## Hardening Adjustments Applied
- Replaced leaked infra label `Active services` with `Active AI workflows` in control panel presenter.
- Replaced leaked infra label `System status` with `Reliability status` in control panel presenter.
- Replaced `Uptime` metric label with `Quality pass` in projects view.
- Removed dependency on template mock-data severity type in UI badge component.

## Remaining Intent
- Continue treating `pulse/` and `linear/` as design references only; no direct domain/copy ingestion.
