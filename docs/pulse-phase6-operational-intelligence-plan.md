# Reliai Pulse — Phase 6 Planning Track (No Implementation)

Date: 2026-05-08  
Status: Planning only (frozen implementation scope)

## Purpose

Define the Phase 6 track for Pulse after parity freeze:
- operational intelligence
- causality
- orchestration boundaries
- automated attribution
- advanced governance

This document is a planning artifact only. No code or UX implementation is included in this phase doc commit.

## Preconditions (Entry Criteria)

Phase 6 work begins only after all are true:
1. Functional parity migration is frozen.
2. Auth/session behavior is verified across signed-out, signed-in, admin/non-admin states.
3. Core/system route stability is confirmed in manual smoke checks.
4. Critical regressions are closed (including sign-out UX).
5. No unresolved merge/conflict markers in `apps/pulse`.

## Non-Goals (for initial Phase 6 slices)

- No redesign of Pulse visual system.
- No broad IA changes.
- No API schema rewrites without explicit migration plan.
- No direct automation that mutates production state without operator confirmation.

## Phase 6 Workstreams

## 1) Causality Layer (Read-Only First)

Goal: explain **what changed before reliability degraded**.

Scope:
- correlate deployments, incidents, regressions, and trace windows
- expose evidence-linked timeline in `/pulse` and `/pulse/system/platform`
- annotate confidence level (`high`, `medium`, `low`) for inferred causality
- require operator review on all inferred relationships (no automated conclusions)

Out of scope:
- rollback execution controls
- auto-remediation actions
- “AI says this caused it” claims

Acceptance:
- each causal statement links to at least one concrete source (deployment ID, incident ID, trace cohort, or metric spike window)
- no claim shown without source attribution
- phrasing is evidence-first and non-absolute:
  - “Likely related change”
  - “Evidence window”
  - “Observed before degradation”
  - “Confidence: low/medium/high”
  - “Requires operator review”

## 2) Attribution Suggestions (Operator-Advisory)

Goal: provide actionable suspected root-cause suggestions without auto-enforcement.

Scope:
- suggestion cards for likely source surface (model, prompt, retrieval, guardrail, deployment)
- “why suggested” evidence summary
- explicit uncertainty labeling when inferred from incomplete data

Out of scope:
- autonomous triage closure
- automatic incident severity changes

Acceptance:
- each suggestion includes source evidence links
- suggestions are non-destructive and operator-reviewed

## 3) Reliability Intelligence Surfaces

Goal: populate `/pulse/system/reliability-patterns` and `/pulse/system/intelligence` with parity-safe intelligence summaries.

Scope:
- recurring failure pattern summaries
- top risk drivers over trailing windows
- service/environment segmentation where data exists

Out of scope:
- new graphing engines
- full benchmark/ranking redesign

Acceptance:
- outputs remain explainable and source-traceable
- unavailable sources degrade gracefully with explicit notices

## 4) Governance and Certification Signal Boundaries

Goal: keep governance truthful while intelligence evolves.

Scope:
- preserve distinction:
  - `certification_status` (decision state)
  - `certification_at_risk` (operational warning)
- add explicit attribution notes where production signals influence risk posture

Out of scope:
- automatic certification revocation
- compliance export redesign

Acceptance:
- no UI/logic path conflates at-risk with final certification decision
- warning reasons always include concrete evidence references

## Delivery Sequence (Recommended)

1. Slice 6.1 — Causality read-only evidence stitching
   - first buildable unit:
     - correlate deployment windows with incidents/regressions/traces
     - show evidence links only
     - no rollback button
     - no auto-RCA
     - no severity changes
     - no certification impact
2. Slice 6.2 — Attribution suggestions (advisory)
3. Slice 6.3 — Reliability patterns/system intelligence summaries
4. Slice 6.4 — Governance boundary hardening and decision-signal audit

Each slice should ship independently with:
- narrow branch scope
- route-limited blast radius
- lint/build + focused manual validation

## Phase Progression

| Phase | Capability | Why |
|---|---|---|
| 6.1 | Read-only causality evidence | Establish trust and explainability first |
| 6.2 | Advisory attribution suggestions | Add operator guidance without automation |
| 6.3 | Reliability intelligence summaries | Aggregate patterns and risk trends |
| 6.4 | Governance boundary hardening | Keep certification logic trustworthy |
| 7.x | Controlled operational actions | Only after evidence + attribution stabilize |

## Validation Framework (Phase 6)

For every slice:
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- route-level manual checks for:
  - source unavailable behavior
  - evidence link integrity
  - admin/non-admin access boundaries where relevant

Quality gates:
- no untraceable intelligence claims
- no hidden data-mode mixing (demo vs live)
- no regression in auth redirects or protected route behavior

## Risks and Mitigations

1. **Noisy intelligence outputs**
- Mitigation: require confidence labels + evidence links

2. **Over-automation risk**
- Mitigation: advisory-first design; operator-confirmed actions only

3. **Governance drift**
- Mitigation: explicit certification vs at-risk boundary tests

4. **Scope creep**
- Mitigation: slice-level non-goals and PR gate checklist

## Deferred Beyond Phase 6

The following capabilities are intentionally excluded from initial operational intelligence rollout:
- rollback execution controls
- automatic RCA conclusions
- autonomous severity changes
- automatic certification state mutation

Reason:
Operational intelligence must first prove:
- evidence integrity
- attribution quality
- operator trustworthiness
- governance auditability

before any system is allowed to:
- mutate production state
- alter incident severity
- affect certification decisions automatically

## PR/Review Template for Phase 6 Slices

Each Phase 6 PR should state:
1. What changed
2. Why it changed
3. Evidence sources used
4. Validation commands and manual checks
5. Risk/rollback plan

---

Owner note: This planning track is intentionally implementation-free and serves as the control document for the next engineering phase.
