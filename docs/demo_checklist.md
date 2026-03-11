# Demo Checklist

Use this before any live demo, usability session, or recorded walkthrough.

## Timing and first impression

- Control panel loads in under 2 seconds on local demo data.
- The first screen answers: is this AI system safe right now?
- The top section clearly shows:
  - reliability score
  - active incidents
  - deployment risk
  - guardrail activity
  - policy compliance

## Control panel flow

- Quick navigation buttons are visible and work:
  - incidents
  - deployments
  - guardrails
  - trace graphs
- The page reads like a system status page, not a generic dashboard.
- The recommended next step is obvious without scrolling through every section.

## Incident investigation flow

- Incident detail shows a likely root cause summary immediately.
- Incident detail shows recommended mitigation immediately.
- Incident command center explains:
  - graph-related patterns
  - deployment changes
  - guardrail activity
  - related regressions

## Trace debugging flow

- Trace detail explains what happened in the request.
- Trace analysis block clearly shows:
  - slowest step
  - largest token consumer
  - guardrail retries
  - estimated cost
- Trace graph renders span types clearly.
- The trace graph legend is visible and understandable.
- Slowest span, largest token span, and guardrail retry span are visually highlighted.

## Replay flow

- Replay section is visible from the trace page.
- Python replay example copies correctly.
- Node replay example copies correctly.
- Replay payload copies correctly.
- Code formatting is readable during screen share.

## Deployment safety gate

- Deployment page shows a clear safety state:
  - SAFE
  - WARNING
  - BLOCKED
- Deployment risk factors are visible without scrolling deeply.
- Recommended guardrail changes are obvious when present.

## Demo sequence

- This navigation path works cleanly:
  - Control Panel
  - Incident
  - Trace Graph
  - Replay
  - Deployment Safety Gate

## Empty and loading states

- Loading skeletons appear on the main demo-path pages.
- Empty states teach the next action instead of looking unfinished.
