# AI Incident Summary v1 — Implementation Plan (finalized)

## Summary
Implement a single AI Summary card in Incident Command Center (right column, above recommendation), backed by an authenticated API endpoint. AI output is explanatory only, grounded in deterministic evidence, cached on the incident, **rate‑limited**, and **logged as an incident timeline event**.

## Key Changes
- **Backend (AI Summary endpoint + service)**
  - Add `POST /api/v1/incidents/{id}/ai-summary` (operator-authenticated).
  - New schema: summary, recommended_next_step, evidence_used, generated_at, model, status.
  - Service composes deterministic evidence (metric delta, root cause confidence/evidence, prompt diff summary, trace comparison, resolution impact if available).
  - Generation via **OpenAI only** in v1.
  - Cache on incident `summary_json` with timestamp.
  - **Rate limit:** 3 generations per incident per 10 minutes (use existing `rate_limiter`).
  - **Log generation as incident event** (`ai_summary_generated`) with evidence refs, model, status, regen flag, duration_ms (optional).

- **Frontend (AI Summary card + behaviors)**
  - Insert card in Incident Command Center right column **above** Action/Recommendation card.
  - Card matches provided UI spec (header, evidence panel, footer actions).
  - States: loading skeletons, insufficient evidence state, error with retry.
  - Actions: auto‑generate on load, Regenerate, Copy (plain text).

- **Shared types + API client**
  - Add AI summary types in `packages/types`.
  - Add fetch helper in `apps/web/lib/api.ts`.

## API Contract (v1)
`POST /api/v1/incidents/{id}/ai-summary`
Request:
```json
{ "tone": "concise", "include_actions": true }
```
Response:
```json
{
  "summary": "...",
  "recommended_next_step": "...",
  "evidence_used": ["Metric delta ...", "Prompt diff ..."],
  "generated_at": "ISO8601",
  "model": { "provider": "openai", "model": "gpt-4.1-mini" },
  "status": "ok" | "insufficient_evidence"
}
```

## Prompt Structure (v1)
- **System:** “Summarize only from provided evidence. Do not invent metrics or causes. Separate facts from inference. Use concise operator language.”
- **Input:** incident title/type, metric delta, root cause confidence/evidence, prompt diff summary, trace comparison summary, recommended fix, resolution impact (if any).
- **Output:** summary paragraph + recommended next step + evidence list derived from inputs.

## Incident Event Logging
- Append incident event on each generation:
```
event_type: "ai_summary_generated"
metadata_json: {
  "status": "success" | "insufficient_evidence" | "error",
  "model": "gpt-4.1-mini",
  "evidence_refs": ["metric_delta", "prompt_diff", "root_cause"],
  "regeneration": true|false,
  "duration_ms": 420
}
```

## Test Plan
- Backend: add 1–2 focused tests for endpoint (`ok` and `insufficient_evidence`) and rate‑limit behavior.
- Frontend: `pnpm --filter web lint`, `pnpm --filter web build`.
- Manual: open command center and verify card renders in all states and timeline logs event.

## Assumptions
- OpenAI only for v1.
- Cache on incident `summary_json`.
- Endpoint requires operator auth (no public/demo access).
- Rate limit is per incident (3 per 10 minutes).
