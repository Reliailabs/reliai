# Reliai Pulse — Phase Roadmap Classification (Post-Review)

## Purpose
Document how recent product-review recommendations map to Reliai’s maturity sequencing.

## Strategic Sequence
Reliai progression remains:

`evidence -> interpretation -> advisory guidance -> governance -> controlled operations -> prediction -> automation`

This sequence is intentionally enterprise-safe and trust-first.

## Immediate (Stabilization-Safe)
These are suitable now and do not violate advisory/governance boundaries.

### 1) KPI hierarchy refinement
- Unify AREI, Risk Delta, and primary Pulse metrics into one operational header.
- Outcome: clearer command-surface scanning.

### 2) Drill-down evidence links
- Ensure attribution and confidence claims link directly to traces/audit evidence.
- Outcome: improved explainability and operator trust.

### 3) Incident trend indicators
- Add compact sparklines / trend velocity beside incidents.
- Outcome: better prioritization without adding automation.

### 4) Accessibility + fatigue hardening
- Formalize contrast, hierarchy, alert-color, and long-session readability standards.
- Outcome: operator usability for sustained workflows.

## Mid-Term (Phase 7–8)
These are directionally correct but should follow controlled-action readiness.

### 5) “View Diff” inside causality evidence
- Useful for forensic inspection, but can imply causation confidence if introduced early.
- Place in late Phase 7 or Phase 8 supervised tooling.

### 6) Draft playbook generation
- Starts crossing into operational recommendation systems.
- Requires strict approval + audit contracts first.
- Place in Phase 8 (supervised execution readiness) or later.

## Long-Term (Phase 8–9)
These require stronger signal quality and trust calibration before rollout.

### 7) Predictive risk
- Moves from observational to probabilistic forecasting.
- Prerequisites:
  - high-quality historical reliability outcomes
  - false-positive performance tracking
  - drift validation
  - operator trust calibration
- Place in late Phase 8 / Phase 9.

## Phase Mapping Summary
| Capability | Recommended Phase |
|---|---|
| KPI hierarchy cleanup | Stabilization (Phase 6.x polish) |
| Evidence drill-down integrity | Stabilization (Phase 6.x polish) |
| Incident trend indicators | Stabilization (Phase 6.x polish) |
| Accessibility/fatigue hardening | Stabilization (Phase 6.x polish) |
| Diff exploration tooling | Phase 7 late / Phase 8 |
| Remediation proposal contracts | Phase 7–8 |
| Supervised operational actions | Phase 8 |
| Predictive risk / forecasting | Phase 8–9 |
| Adaptive operational intelligence | Phase 9+ |

## Guardrail
Do not collapse this roadmap into automation-first execution.

Reliai remains:
- evidence-first,
- advisory-first,
- governance-safe,
- human-in-the-loop before any execution.
