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
Phase 10.4 introduced score snapshot infrastructure (`getReliabilityScore` + repository/tests).
Phase 10.6 consumes this snapshot on the operations read path as a read-only summary. This remains parity-safe and does not introduce write semantics or local scoring derivation.

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
  - reliability snapshot read-consumer contracts:
    - operations surface includes reliability snapshot payload
    - snapshot governance invariants preserved in read surface
- Out of scope:
  - UI presenter smoke tests (optional; when added, keep them outside the core lifecycle gate unless they validate lifecycle contract semantics directly)
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

## Phase 10.10 Closure Note
- Code gate remains mandatory in CI: `pnpm --filter pulse test:phase10-lifecycle-gate`.
- Operations reliability presenter smoke is CI-enforced in `pulse-route-gate`: `pnpm --filter pulse test:operations-reliability-presenter-smoke`.
- Lifecycle/read-path contract slices 10.1–10.9 are complete under parity-only scope.
- Remaining work moves to Phase 11 read-path persistence/integration hardening.
