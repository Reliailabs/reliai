# Reliai End-to-End Demo QA Checklist

Purpose:

Ensure the Reliai platform behaves exactly as claimed during demos and customer walkthroughs.

This checklist verifies:
- SDK install
- telemetry ingestion
- incident detection
- trace graph
- guardrails
- deployment safety
- event pipeline
- demo flows
- marketing routes
- screenshots
- documentation accuracy

Run this checklist before:
- sales demos
- investor demos
- conference demos
- recorded product walkthroughs

## Test Environment Setup

Verify the following first:

- Backend API running
- Web app running
- Database migrations applied
- Demo project available
- API key available

Optional infrastructure, if the scenario depends on it:
- trace warehouse reachable
- workers running

Verify services:

- API server responding
- Web app accessible
- workers running

Command sanity check:

```bash
pnpm --filter web build
pnpm --filter web lint
pytest apps/api/tests
```

Use the stabilization refresh sequence first:

```bash
cp .env.example .env
make install
make db-up
make db-migrate
make seed
```

Run the app:

```bash
make dev
pnpm --filter web dev --port 3000
make worker
```

Reference:
- [docs/stabilization-runbook.md](/Users/robert/Documents/Reliai/docs/stabilization-runbook.md)
- [docs/validation-matrix.md](/Users/robert/Documents/Reliai/docs/validation-matrix.md)

## 1. Homepage Marketing Verification

Open:

`/`

Confirm hero renders:

Headline visible:
`Know when your AI breaks—before your users do.`

Confirm subheadline renders.

Verify hero install command block:

`pip install reliai`

Verify Copy button works.

Verify CTA links:

- Try Playground -> `/playground`
- View Demo -> `/demo`
- Get Started -> `/signup`

Confirm control panel screenshot loads.

## 2. SDK Install Verification

### Python SDK

Run:

```bash
pip install reliai
```

Create test script:

```python
import reliai

reliai.init(api_key="test")

with reliai.trace("demo-test"):
    pass
```

Verify:

- trace successfully ingested
- trace visible in dashboard
- trace has span data
- trace timestamp correct

### Node SDK

Install:

```bash
npm install reliai
```

Example:

```ts
import { reliai } from "reliai"

reliai.init({
  apiKey: process.env.RELIAI_API_KEY
})
```

Verify:

- trace successfully appears
- span tree created
- trace ID generated

## 3. Trace Ingestion Pipeline

Create multiple traces.

Verify system shows:

- `trace_id`
- `span_id`
- `parent_span_id`
- `span_name`
- latency
- tokens
- `guardrail_policy`

Confirm trace ingestion events:

- `trace_ingested`
- `trace_evaluated`

Verify event persisted in:

- `event_log`

## 4. Trace Graph Verification

Open a trace.

Navigate to:

`/traces/{traceId}/graph`

Verify UI shows:

- span hierarchy
- latency per span
- token usage
- guardrail intervention markers

Verify analysis panel shows:

- slowest span
- largest token span
- retry spans

Confirm graph renders within 2 seconds on local demo data.

## 5. Incident Detection

Trigger failure scenario:

- bad prompt
- invalid structured output
- high latency

Verify system response:

- incident automatically created
- incident appears in control panel
- incident status visible

Verify incident details include:

- likely root cause
- related traces
- deployment context

## 6. Incident Command Center

Open:

`/incidents/{incidentId}/command`

Verify visibility of:

- incident severity
- incident timeline
- trace comparison
- recommended mitigation

Confirm navigation works:

- open trace
- open deployment
- open related regression

## 7. Guardrail Policy Enforcement

Verify organization policy exists.

Test policy types:

- structured_output
- latency_retry
- cost_budget

Simulate violation.

Verify:

- `policy_violation` event emitted
- guardrail action triggered
- violation visible in trace

Check control panel compliance section updates.

## 8. Deployment Safety Gate

Create test deployment.

Navigate:

`/deployments/{deploymentId}`

Verify gate status displays:

- SAFE
- WARNING
- BLOCKED

Verify gate explanation includes:

- risk factors
- pattern signals
- guardrail coverage
- recent incidents

## 9. Reliability Intelligence

Navigate to the intelligence surfaces.

Verify visibility of:

- reliability patterns
- recommended guardrails
- pattern impact score

Relevant routes and endpoints:

- `/system/reliability-patterns`
- `/api/v1/intelligence/patterns`
- `/api/v1/intelligence/high-risk-patterns`
- `/api/v1/intelligence/guardrail-recommendations`
- `/api/v1/intelligence/global-patterns`

Verify patterns include:

- description
- recommended mitigation
- impact estimate

## 10. Global Reliability Patterns

Open:

`/api/v1/intelligence/global-patterns`

Verify response includes:

- `pattern_id`
- description
- impact
- `recommended_guardrails`
- `organizations_affected`

Confirm patterns load in UI intelligence surfaces where applicable.

## 11. Event Log Verification

Check event persistence.

Confirm `event_log` contains entries:

- `trace_ingested`
- `trace_evaluated`
- `policy_violation`
- `incident_created`
- `deployment_created`

Verify event fields:

- `event_id`
- `event_type`
- `timestamp`
- `payload_json`

## 12. Event Replay Worker

Run worker:

`reprocess_events_worker`

Verify:

- events replay without error
- derived state rebuilt
- processors triggered correctly

## 13. Extension Runtime Verification

Navigate to:

`/system/extensions`

Verify extension list shows:

- processor_type
- version
- enabled
- last_invoked
- recent_failures

If a test extension is available:

- install or enable it
- verify extension executes
- verify invocation count increases

## 14. Control Panel Verification

Navigate to project control panel.

Verify visibility of:

- reliability score
- active incidents
- guardrail activity
- high-risk patterns
- recent deployments

Confirm links navigate correctly:

- incident
- deployment
- trace
- guardrail

## 15. Playground Verification

Navigate:

`/playground`

Test scenarios:

- hallucination
- latency
- model regression
- retrieval failure

Verify stage progression:

- `idle`
- `failure_triggered`
- `incident_created`
- `trace_analysis`
- `guardrail_recommended`

Verify final CTA appears.

## 16. Interactive Demo Verification

Open:

`/demo`

Verify demo tour:

- control panel step
- incident step
- trace step
- mitigation step
- deployment gate step

Verify tour overlays position correctly.

## 17. Screenshot Routes

Open routes:

- `/marketing/screenshot/control-panel`
- `/marketing/screenshot/trace-graph`
- `/marketing/screenshot/incident`
- `/marketing/screenshot/deployment`
- `/marketing/screenshot/playground`

Verify:

- no navigation chrome
- fixed width
- stable layout

## 18. Screenshot Generation

Run:

```bash
pnpm screenshots:marketing:core
pnpm screenshots:marketing
pnpm screenshots:playground
```

Verify generated assets:

`apps/web/public/screenshots/`

Confirm resolution:

`3200 x 2000`

Confirm images render correctly on homepage.

## 19. Marketing Page Links

Verify:

- `/docs`
- `/pricing`
- `/login`
- `/signup`

Load correctly.

Verify no broken links.

## 20. Documentation Accuracy

Verify docs match reality.

Check:

- [docs/sales-product-update.md](/Users/robert/Documents/Reliai/docs/sales-product-update.md)
- [docs/product-capabilities.md](/Users/robert/Documents/Reliai/docs/product-capabilities.md)
- [docs/demo_script.md](/Users/robert/Documents/Reliai/docs/demo_script.md)

Confirm:

- no feature claims beyond implementation
- demo script matches UI flow

## 21. Performance Sanity Checks

Verify pages load within expected time.

Target:

- homepage < 1.5s
- demo < 2s
- control panel < 2s
- trace graph < 2s

## 22. Final Demo Readiness Check

Run a full demo sequence:

Homepage  
-> Demo  
-> Control Panel  
-> Incident  
-> Trace Graph  
-> Guardrail Recommendation  
-> Deployment Gate

Confirm the narrative:

- problem detected
- root cause explained
- mitigation recommended
- deployment protected

## Demo Pass Criteria

The platform is considered demo ready if:

- SDK installs successfully
- traces appear
- incidents open automatically
- trace graph renders correctly
- guardrails trigger
- deployment gate functions
- demo path flows smoothly
- screenshots reflect real UI
