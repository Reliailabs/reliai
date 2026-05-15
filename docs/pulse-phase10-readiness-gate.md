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

## Executable Validation Gate
Run:
- `pnpm --filter pulse test:phase10-lifecycle-gate`

This gate must pass in CI (`pulse-route-gate`) before Phase 10 lifecycle work is treated as validated.

## Phase 10.4 Scope Note
Phase 10.4 currently ships score snapshot infrastructure only (`getReliabilityScore` + repository/tests).
No Pulse UI surface consumes this read-path yet. Do not treat this as reliability-score presenter parity.

## Gate Ownership Rules
To prevent gate drift, `test:phase10-lifecycle-gate` is constrained as follows:
- In scope:
  - lifecycle state machine and transition invariants
  - repository contract invariants
  - lifecycle create/transition/write-path validation contracts
  - lifecycle ingest projection contracts
  - timeline projection hardening contracts:
    - deterministic ordering
    - dedupe behavior
    - lifecycle + verification projection merge consistency
    - policy-result mapping consistency
    - duplicate-ingest replay resilience
  - reliability score snapshot contracts:
    - deterministic score clamping and rounding
    - verification pass-rate mapping consistency
    - read-only snapshot repository ordering/filtering
  - verification read-path contracts:
    - lifecycle -> verification result mapping invariants
    - centralized verification repository filter consistency
    - incident/regression surfaces consume shared verification read model
- Out of scope:
  - UI presenter smoke tests
  - cross-surface route migration tests
  - unrelated assisted-automation suggestion UX tests
  - long-running e2e/browser flows
- Runtime budget:
  - target under 2 seconds local runtime on baseline dev machine
  - warning threshold: over 5 seconds in CI
- Determinism:
  - tests must be order-independent and avoid shared mutable global state
  - no network dependencies
  - fixture data must be local and deterministic
- Failure policy:
  - CI failure blocks merge for Phase 10 lifecycle-affecting changes
  - release readiness requires gate pass on `main`

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
