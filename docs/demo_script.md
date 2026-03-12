# 3-Minute Demo Script

## Goal

Show a first-time engineer what Reliai does in under 3 minutes:

- what is happening in the AI system
- what went wrong
- what Reliai recommends
- what the operator should do next

## Most Important Demo Rule

Do not rely on live system state during a demo.

Use a deterministic demo scenario instead:

- seeded traces
- at least one visible incident
- at least one deployment
- at least one visible guardrail or mitigation signal

If the dashboard is empty, the product story collapses even when the system is functioning correctly.

Before starting any demo:

1. run `make seed`
2. open the seeded project control panel
3. confirm one incident or warning state is visible
4. confirm the trace list is populated

The safest demo project remains the seeded project:

- `cb2dfd2d-69af-4545-a2e8-131bf6e491b8`

## 30-Second Control Panel Explanation

Use this when you want the product value to land before any clicks.

### Step 1 — Start with the operator question

Say:

"The control panel answers one question: is my AI system safe right now?"

### Step 2 — Show the system status

Point to:

- reliability score
- active incidents
- guardrail activity

Say:

"This reliability score summarizes system health. If something breaks, Reliai automatically detects the regression and opens an incident."

### Step 3 — Show the current problem

Point to the incident or high-risk pattern.

Say:

"Here the system detected a regression in production. Instead of engineers discovering it from user reports, Reliai flags it immediately."

### Step 4 — Show the suggested fix

Point to the recommended guardrail or mitigation.

Say:

"Reliai then analyzes traces and patterns across the system and recommends a guardrail or mitigation before the issue spreads."

## One-Sentence Summary

Use this when you need an even faster setup line:

"Reliai is the control plane for AI reliability. It detects regressions, explains why they happened, and recommends guardrails before users see the failure."

## Demo path

1. Control panel
2. Incident
3. Trace graph
4. Recommended guardrail
5. Deployment safety gate

## Script

### 1. Start on the control panel

Open:

- `/projects/{projectId}/control`

Say:

"Reliai is the reliability control plane for AI systems. The control panel answers one question: is my AI system safe right now?"

Point to:

- reliability score
- guardrail activity
- active incidents

Then say:

"If something breaks in production, such as hallucinations, latency spikes, or model regressions, Reliai detects it automatically and opens an incident."

### 2. Open an incident

Say:

"Here the system detected a regression after a prompt or runtime change. Instead of users reporting bad responses, Reliai flagged it immediately."

Point to:

- incident summary
- likely root cause
- affected traces
- recommended mitigation

Then say:

"The platform analyzes production traces to determine what changed and where the failure occurred."

### 3. Open the trace graph

Say:

"Every AI request is traced across retrieval, prompt construction, model calls, and guardrails."

Point to:

- span legend
- latency per span
- slowest span
- largest token span

Then say:

"Here you can see exactly where the pipeline failed."

### 4. Show the recommended guardrail

Say:

"Reliai does not just detect problems. It recommends mitigations."

Point to:

- recommended guardrail
- explanation

Then say:

"In this case the system suggests enabling structured output validation or another targeted guardrail to stop the failure from spreading."

### 5. Show deployment safety gate

Open the linked deployment.

Say:

"Reliai also treats AI changes like release risk. Before or after rollout, it scores the change and explains whether it is safe."

Point to:

- SAFE / WARNING / BLOCKED badge
- deployment risk factors
- recommended guardrails

Close with:

"That is the full loop: system status, incident detection, trace-level debugging, guardrail recommendation, and deployment safety. Reliai is an AI reliability control plane, not just another dashboard."

## Demo tips

- Never start with SDK install, settings, or configuration screens.
- Start with the control panel because it answers the production-state question immediately.
- Keep the control panel on screen long enough for the viewer to orient.
- Do not start with trace detail. Start with operator context.
- Use one incident and one trace so the flow feels connected.
- If a page has no data, explain the empty state as setup guidance rather than skipping awkwardly.
