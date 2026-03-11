# 3-Minute Demo Script

## Goal

Show a first-time engineer what Reliai does in under 3 minutes:

- what is happening in the AI system
- what went wrong
- what Reliai recommends
- what the operator should do next

## Demo path

1. Control panel
2. Incident
3. Trace graph
4. Replay
5. Deployment safety gate

## Script

### 1. Start on the control panel

Open:

- `/projects/{projectId}/control`

Say:

"This is the system status page for one AI system. The first question Reliai answers is: is this system safe right now?"

Point to:

- reliability score
- active incidents
- deployment risk
- guardrail activity
- policy compliance

Then say:

"From one screen, the operator can see whether the system is stable, whether a deployment is risky, and whether runtime protection is actually covering production."

### 2. Open an incident

Say:

"If something regresses, Reliai opens an incident and summarizes what probably broke."

Point to:

- likely root cause
- deployment changes
- guardrail triggers
- recommended mitigation

Then say:

"The point is not just to detect a regression. It is to explain what changed and what the operator should do next."

### 3. Open the trace graph

Say:

"From the incident, we can pivot into a single request and inspect the execution graph."

Point to:

- span legend
- slowest span
- largest token span
- guardrail retry span

Then say:

"This is the debugging view. It breaks one AI request into retrieval, prompt build, model call, tools, guardrails, and post-processing so the operator can see where the request degraded."

### 4. Show replay

Say:

"If an engineer wants to reproduce the issue locally, Reliai gives them replay snippets directly from the trace."

Point to:

- Python replay example
- Node replay example
- copy buttons

Then say:

"This makes the handoff from operator to engineer much faster. You are not just looking at telemetry, you can replay the request locally."

### 5. Show deployment safety gate

Open the linked deployment.

Say:

"Reliai also treats AI changes like release risk. Before or after rollout, it scores the change and explains whether it is safe."

Point to:

- SAFE / WARNING / BLOCKED badge
- risk score
- deployment risk factors
- recommended guardrails

Close with:

"That is the full loop: system status, incident detection, request-level debugging, replay, and deployment safety. Reliai is an AI reliability control plane, not just another dashboard."

## Demo tips

- Keep the control panel on screen long enough for the viewer to orient.
- Do not start with trace detail. Start with operator context.
- Use one incident and one trace so the flow feels connected.
- If a page has no data, explain the empty state as setup guidance rather than skipping awkwardly.
