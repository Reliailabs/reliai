# Pulse Phase 10+ — Readiness Gate Checklist

## Purpose
Provide a strict go/no-go checklist before any autonomous operations experiment.

## Required Gate
All items must be `pass` before proceeding:
- [ ] Phase 8 supervised execution is production-stable.
- [ ] Phase 9 assisted automation is policy-compliant.
- [ ] Evidence integrity audits pass for 2+ release cycles.
- [ ] Operator trust review indicates acceptable confidence.
- [ ] Governance board approves autonomous pilot scope.
- [ ] Kill-switch drills successfully exercised.

## Pilot Constraints
- Single environment pilot.
- Narrow action classes only.
- Real-time operator override always available.
- Daily review during pilot window.

## Stop Conditions
Immediate stop and rollback to supervised mode if:
- policy violation occurs
- audit gap is detected
- false-positive threshold is breached
- operator override usage spikes beyond threshold
