# Pulse Operator Intelligence Consistency QA Matrix

## Purpose
Validate trust and consistency of advisory operator-intelligence snippets across:
- `/deployments`
- `/incidents`
- `/errors`
- `/traces`

This matrix is for Phase 6 read-only surfaces and ensures predictable degradation when evidence is weak or unavailable.

## Shared Acceptance Rules
- Confidence label must be one of: `insufficient data`, `low confidence`, `medium confidence`, `high confidence`.
- `Requires operator review` must be visible on every intelligence panel.
- Panels must remain advisory-only; no deterministic causation language.
- Evidence links must be shown under `Evidence references` when concrete links exist.
- `insufficient data` must appear when concrete evidence references are missing.

## Surface Matrix
| Surface | Positive Path | Negative Path | Expected Result |
|---|---|---|---|
| `/deployments` | deployment detail includes risk explanations + guardrails + linked incidents | missing deployment evidence payload | panel renders advisory copy with `insufficient data`; no authoritative language |
| `/incidents` | incident detail includes compare path + deployment context + trace samples | empty incident factors / no evidence links | contributing factors collapse to insufficient evidence message; confidence remains `insufficient data` |
| `/errors` | linked incident/traces/deployments present | unavailable upstream source (`incidents` or `traces` fetch fails) | compact unavailable notice appears; panel does not overstate confidence |
| `/traces` | failed traces + related incident/deployment signals present | broken trace evidence link or no correlated signals | panel still renders with `insufficient data` and bounded evidence references |

## Manual Test Checklist

### Deployments
- [ ] Intelligence panel visible in existing deployments surface.
- [ ] Uses `Observed contributing factors` wording.
- [ ] Uses `Evidence references` wording.
- [ ] Shows `Requires operator review`.
- [ ] Negative-path check: simulate missing intelligence payload and confirm `insufficient data`.

### Incidents
- [ ] Intelligence panel appears in right-side incident detail.
- [ ] Confidence changes only when concrete evidence references exist.
- [ ] Evidence references links are visible and readable.
- [ ] Negative-path check: no compare/deployment/trace evidence -> `insufficient data`.

### Errors
- [ ] Error intelligence panel appears in existing `/errors` surface.
- [ ] Confidence label format matches shared semantics.
- [ ] `Evidence references` appears above links.
- [ ] Negative-path check: source unavailable case surfaces compact warning and non-authoritative state.

### Traces
- [ ] Trace intelligence panel embedded in existing performance/traces surface.
- [ ] Uses `Observed contributing factors` and `Related operational signals`.
- [ ] Uses `Evidence references`.
- [ ] Negative-path check: no correlated signals -> `insufficient data` + advisory language.

## Build/Lint Validation
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`

## Notes
- This QA pass intentionally excludes new route surfaces, automation, severity mutation, and certification mutation.
- Any failures should be fixed as stabilization regressions, not feature expansion.
