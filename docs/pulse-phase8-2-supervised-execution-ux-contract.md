# Pulse Phase 8.2 — Supervised Execution UX Contract

## Status
Planning-only UX/interaction contract.

## Objective
Define how approved actions are confirmed and executed with explicit operator intent.

## Hard Boundary
No silent actions. No background execution without foreground operator confirmation.

## UX Contract
1. Action proposal card must show `action_type`, `target`, `evidence_refs`, and `approval_state`.
2. Execution CTA is disabled unless proposal is `approved` and policy checks pass.
3. Confirmation modal must include:
   - action summary
   - target summary
   - evidence links
   - reversibility warning
   - explicit confirmation language
4. Operator must confirm with a final action (no implicit submit on close/blur).
5. Post-submit state must show `queued|running|succeeded|failed|blocked`.

## Required Language
Use trust-safe wording:
- "Operator-approved execution"
- "Requires operator confirmation"
- "May be non-reversible"

Avoid definitive causation language and avoid automation language.

## Telemetry
Track UX checkpoints:
- execution confirmation opened
- execution confirmed
- execution cancelled
- execution failed/blocked

## Non-Goals
- No new panel redesign.
- No AI-generated action text expansion.
- No auto-confirm defaults.
