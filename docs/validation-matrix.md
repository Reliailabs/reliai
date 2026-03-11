# Reliai Validation Matrix

Last updated: March 11, 2026

Use this matrix during stabilization. Mark each item manually during a validation pass.

## 1. Environment And Auth

| Area | Check | Expected Result |
| --- | --- | --- |
| Local stack | `make install`, `make db-up`, `make db-migrate`, `make seed` | Local environment refreshes cleanly |
| API health | `curl -s http://127.0.0.1:8000/api/v1/health` | Health endpoint returns success |
| Web health | `curl -I http://127.0.0.1:3000` | Web responds successfully |
| Local dev auth | Sign in with seeded credentials | Product shell loads |
| WorkOS auth | Sign in with configured WorkOS env | Callback and app entry work correctly |

## 2. Marketing And Demo Truth

| Claim / Surface | Validation Step | Expected Result |
| --- | --- | --- |
| Detects regressions | Trigger a failing scenario | Regression or incident appears |
| Explains root causes | Open incident and command center | Root-cause summary is visible |
| Applies guardrails | Inspect mitigation and policy surfaces | Guardrail recommendation or intervention is visible |
| Protects production | Open deployment detail | Safety state is visible and understandable |
| Homepage CTA flow | Visit `/` and follow CTA links | `/demo`, `/playground`, and `/signup` routes work |

## 3. Operator Workflow

| Step | Validation Step | Expected Result |
| --- | --- | --- |
| Control panel | Open project control panel | Reliability score, incidents, deployment risk, guardrails, compliance are visible |
| Incident | Open incident detail | Likely root cause and recommended mitigation are visible |
| Command center | Open incident command center | Trace compare, deployment context, and related regressions are visible |
| Trace graph | Pivot from incident to trace | Span hierarchy and analysis are clear |
| Replay | Use replay section | Python and Node snippets copy correctly |
| Deployment gate | Open related deployment | `SAFE`, `WARNING`, or `BLOCKED` is visually obvious |

## 4. SDK And Guardrails

| Area | Validation Step | Expected Result |
| --- | --- | --- |
| Python SDK | Send trace + span | Trace and span appear in product |
| Node SDK | Send trace + span | Trace and span appear in product |
| Structured output policy | Trigger violation | `policy_violation` event and intervention record appear |
| Latency policy | Trigger violation | Guardrail event is recorded |
| Cost policy | Trigger violation | Guardrail or block behavior is visible |

## 5. Event Pipeline And Replay

| Event / Worker | Validation Step | Expected Result |
| --- | --- | --- |
| `trace_ingested` | Ingest trace | Event exists in `event_log` |
| `trace_evaluated` | Run evaluation processor | Derived state updates |
| `policy_violation` | Trigger runtime policy | Event exists and compliance surfaces update |
| `deployment_created` | Create deployment | Deployment surface reflects new state |
| `incident_opened` | Trigger incident | Incident surfaces reflect the new event |
| Replay worker | Run `reprocess_events_worker` | Replay completes without corrupting state |

## 6. Marketing Assets

| Route / Asset | Validation Step | Expected Result |
| --- | --- | --- |
| `/marketing/screenshot/control-panel` | Load route | Stable screenshot layout |
| `/marketing/screenshot/trace-graph` | Load route | Stable screenshot layout |
| `/marketing/screenshot/incident` | Load route | Stable screenshot layout |
| `/marketing/screenshot/deployment` | Load route | Stable screenshot layout |
| `/marketing/screenshot/playground` | Load route | Stable screenshot layout |
| Screenshot generation | Run screenshot scripts | PNGs generate without auth or chrome drift |

## 7. Playground

| Scenario | Validation Step | Expected Result |
| --- | --- | --- |
| Hallucination | Run scenario | Stage progression is clear |
| Latency regression | Run scenario | Stage progression is clear |
| Model regression | Run scenario | Stage progression is clear |
| Retrieval failure | Run scenario | Stage progression is clear |

Expected stages:
- `idle`
- `failure_triggered`
- `incident_created`
- `trace_analysis`
- `guardrail_recommended`

## 8. Documentation Truthfulness

| Document | Validation Step | Expected Result |
| --- | --- | --- |
| `docs/sales-product-update.md` | Compare claims to product | Only implemented capabilities are described |
| `docs/product-capabilities.md` | Compare inventory to repo | Capabilities list matches actual platform |
| `docs/demo_script.md` | Run live demo sequence | Script matches actual UI path |
| `docs/demo_checklist.md` | Use during demo prep | Checklist matches the current product |
