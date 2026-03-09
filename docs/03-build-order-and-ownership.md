# Build Order and Ownership

## Principle
Ship vertical slices, not isolated layers.
Each milestone should result in a real end-to-end capability.

## Milestone 1 — Foundation
### Outcome
A signed-in operator can create a project, generate an API key, and the system can ingest a trace.

### Product + Architecture
- finalize org/project/API key rules
- approve trace payload contract
- define onboarding checklist

### Full-stack engineer
- auth shell
- project creation UI
- onboarding page
- API key reveal flow

### Platform/backend engineer
- org/project/api-key models
- key hashing
- ingest endpoint
- trace persistence

### Designer
- onboarding flow wireframes
- project creation UX
- code snippet presentation

---

## Milestone 2 — Trace Explorer
### Outcome
Operators can browse traces and inspect a single request.

### Product + Architecture
- finalize filters and trace detail requirements
- define safe preview strategy for input/output text

### Full-stack engineer
- traces list screen
- filters
- trace detail page

### Platform/backend engineer
- traces query endpoints
- trace detail endpoint
- indexes and pagination

### Designer
- dense table layout
- trace detail hierarchy
- error/empty states

---

## Milestone 3 — Evaluations
### Outcome
Every eligible trace gets scored asynchronously.

### Product + Architecture
- define v1 score semantics
- approve concise evaluation explanations

### Full-stack engineer
- evaluations panel UI on trace page
- score badges and labels

### Platform/backend engineer
- RQ worker setup
- eval job pipeline
- structured validity, relevance, groundedness

### Designer
- evaluation visual language
- pass/fail/warning system

---

## Milestone 4 — Regressions + Incidents
### Outcome
The platform creates incidents from reliability changes.

### Product + Architecture
- define thresholds and severity mapping
- approve fingerprinting and dedupe rules

### Full-stack engineer
- incidents list screen
- incident detail page
- acknowledge/resolve actions

### Platform/backend engineer
- rollup jobs
- regression rules
- incident persistence and state transitions

### Designer
- severity system
- incident page layout
- baseline vs current comparison UX

---

## Milestone 5 — Alerting
### Outcome
Meaningful incidents notify operators.

### Product + Architecture
- define alert message standard
- define cooldown behavior

### Full-stack engineer
- alert channels UI
- alert rules UI

### Platform/backend engineer
- Slack dispatch
- email dispatch
- webhook dispatch
- cooldown checks

### Designer
- settings IA
- configuration clarity
- channel status states

---

## Milestone 6 — Design Partner Readiness
### Outcome
The product is installable and legible for real users.

### Product + Architecture
- approve pilot scope
- finalize instrumentation docs
- identify launch blockers

### Full-stack engineer
- polish overview page
- improve onboarding guidance
- seed/demo mode

### Platform/backend engineer
- SDKs
- deploy readiness
- queue reliability hardening

### Designer
- setup tutorial visuals
- empty states
- loading states
- final dashboard polish
