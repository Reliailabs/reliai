# Reliai 5-Minute Demo Smoke Test

Purpose:

Quick verification that the Reliai platform is working before a live demo.

Run this checklist immediately before:
- sales demos
- investor demos
- recorded walkthroughs

Expected time: about 5 minutes

## Pre-Demo State Rule

Do not rely on live system state.

Before the call, confirm the seeded or demo project has:

- at least one visible incident or warning state
- populated traces
- at least one deployment
- at least one visible mitigation or guardrail signal

If the main control panel is empty, reseed before presenting.

## 1. Homepage Loads

Open:

`/`

Verify:
- hero headline visible
- install command visible
- control panel screenshot loads

## 2. Playground Loads

Open:

`/playground`

Verify:
- failure selector visible
- control panel preview renders

## 3. Trigger Playground Failure

Select:

`Hallucination`

Verify progression:

- `failure_triggered`
- `incident_created`
- `trace_analysis`
- `guardrail_recommended`

## 4. Demo Page Loads

Open:

`/demo`

Verify:
- guided tour starts
- control panel demo data visible

## 5. Control Panel

Open a real project.

Verify visible:

- reliability score
- active incidents
- guardrail activity
- recent deployments

## 6. Trace Detail

Open any trace.

Verify:

- trace metadata visible
- span list present
- latency values present

## 7. Trace Graph

Navigate to:

trace -> graph

Verify:

- span tree renders
- slowest span highlighted

## 8. Incident Page

Open any incident.

Verify:

- incident status
- likely root cause
- recommended mitigation

## 9. Deployment Page

Open any deployment.

Verify gate status shows:

- SAFE
- WARNING
- BLOCKED

## 10. Intelligence Surface

Verify reliability patterns load.

Look for:

- pattern description
- recommended guardrail
- impact score

Suggested routes:

- `/system/reliability-patterns`
- `/api/v1/intelligence/global-patterns`

## 11. Screenshot Routes

Open:

`/marketing/screenshot/control-panel`

Verify:
- UI renders without navigation
- layout stable

## 12. API Health Check

Verify the API is reachable:

`/api/v1/health`

Expected:

- `200 OK`

Optional authenticated product check:

- sign in first
- open a project surface such as `/projects/{projectId}/control`
- confirm data loads

## Demo Ready Criteria

Reliai is ready for a live demo if:
- homepage loads correctly
- playground simulation works
- control panel displays data
- trace graph renders
- incident page loads
- deployment gate visible

If any of these fail, fix before presenting.
