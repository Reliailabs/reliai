# Pulse Phase 9.2 — Assisted Incident Automation Contract

## Status
Implemented. Runtime mapping below.

## Runtime Mapping

| Contract item | Implementation |
|---|---|
| Auto-draft incident note | `buildIncidentSuggestions()` → `suggestion.draft_note` |
| Auto-suggest assignee candidates | `suggestion.assignee_candidates` ranked from `available_operators[]` |
| Auto-stage escalation recommendation | `suggestion.escalation_recommendation` with confidence + rationale |
| Operator accept/reject | `validateIncidentSuggestionReview()` → `POST /api/actions/assisted-automation/incident/suggest/[id]/review` |
| Evidence citation required | Enforced by Zod schema (`evidence_refs` min 1) + internal-href guard |
| Confidence + operator review flag | `requires_operator_review: true` on draft_note and escalation_recommendation |
| No incident mutation | Validated by test: output contains no ack/assign/status/severity/escalate fields |
| Rejection logging | Review returns `{ logged: true }` in Phase 9 envelope; no FastAPI call |

## Entry Points

- `POST /api/actions/assisted-automation/incident/suggest` — generate suggestion (read-only)
- `POST /api/actions/assisted-automation/incident/suggest/[proposal_id]/review` — log operator decision

## Objective
Define bounded assisted automation for incident workflows without autonomous resolution.

## Allowed Assisted Actions
- Auto-draft incident notes from linked evidence.
- Auto-suggest assignee candidates (no assignment mutation).
- Auto-stage escalation recommendation (operator confirms).
- Auto-open related investigation links (read-only).

## Required Constraints
- Every suggestion must cite evidence references.
- Suggestions must include confidence + "Requires operator review".
- No automatic incident status transition.
- No severity mutation without explicit approval flow.

## Operator Interaction
- Operator can accept/reject each suggestion independently.
- Rejections are logged with reason to improve future policy tuning.

## Non-Goals
- No autonomous incident closure.
- No automatic paging execution.
