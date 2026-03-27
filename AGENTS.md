# AGENTS.md

## Mission
Build a production-minded MVP for an **AI Reliability Platform** that helps teams:
- trace AI requests
- score outputs
- detect regressions
- surface incidents
- alert operators

This repo is not for generic "AI app" demos. It is for a **sharp, operator-grade product**.

## Product standard
Every decision must support this product promise:

> Catch AI regressions before users do.

The v1 wedge is:
- request tracing
- evaluations
- regression detection
- incidents
- alerting
- operator dashboard

Do not drift into generic chatbot UX, vanity AI features, or a bloated observability suite.

## Anti-AI-slop rules
Avoid:
- generic dashboards with filler cards
- vague labels like "smart insights" or "AI-powered analytics"
- purple gradient SaaS clichés
- fake data structures that do not map to real operations
- decorative complexity without operator value
- stubbed pages that imply completed functionality
- broad platform claims that are not implemented

Prefer:
- clear operator language
- concrete metrics
- traceability from UI -> API -> schema
- boring, correct data models
- simple workflows with real production value
- strong defaults and tight scope

## Implementation priorities
Always prioritize in this order:
1. correctness
2. operational clarity
3. installability
4. maintainability
5. aesthetics

## Reliai Engineering Rules
- Favor boring architecture over clever architecture
- Avoid speculative abstractions
- Prefer explicit schemas
- Prefer inspectable data models
- All endpoints must have typed request/response models
- All schema changes must have migrations
- Trace ingestion must remain fast and simple

## Stack constraints
Default stack:
- Frontend: Next.js, TypeScript, Tailwind, shadcn/ui
- Backend API: FastAPI
- Workers: RQ + Redis
- Database: PostgreSQL
- Auth: Clerk or WorkOS AuthKit
- Charts: lightweight, readable, no visual clutter

Do not swap core stack pieces unless there is a concrete implementation reason.

## Use of skills
When permissible, use specialized skills to raise quality.

### Required skill usage guidance
- For product UI or visual refinement tasks, use the `frontend-design` skill.
- Install it with:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

### Local role docs to consult
Use these local files as role-specific skills:
- `skills/product-architecture.md`
- `skills/fullstack-engineer.md`
- `skills/platform-backend-engineer.md`
- `skills/designer.md`

Before major tasks, read the relevant skill doc and follow it.

## Delivery behavior for Codex
For every task:
- inspect the relevant spec docs first
- state assumptions briefly
- implement the smallest complete slice that works
- keep naming clean and production-friendly
- avoid speculative abstraction
- return:
  - files changed
  - what was implemented
  - any tradeoffs
  - next recommended step

## QA Gate
- Before starting each milestone, run `docs/QA-CHECKLIST.md`.
- Treat investigation flows as release-critical:
  - incident page
  - regression page
  - compare page
  - trace pivots
- Periodically run the repo QA audit prompt in `QA-Prompt-Codex.md`, especially every 2 to 3 milestones.

## QA gate
Before starting each new milestone or major structural change:
- read `docs/QA-CHECKLIST.md`
- run the milestone QA gate appropriate to the current state of the repo
- do not begin the next milestone until critical QA failures are understood or fixed

## Output style
When presenting work:
- be concrete
- cite filenames precisely
- mention migrations, endpoints, and env vars when relevant
- do not produce marketing fluff

## Design rules
The UI should feel like a serious operator product.

It should look:
- calm
- high-signal
- dense enough for professionals
- not cluttered
- not consumer-app playful

Use:
- strong hierarchy
- excellent spacing
- concise labels
- visible states for incident severity and regression direction
- careful empty states that teach setup

Do not use:
- overdone gradients
- oversized cards with weak content
- noisy icon walls
- meaningless microcopy

## Architecture rules
- Keep tenant boundaries explicit.
- Every screen should be backed by real API contracts.
- Every API should map to real storage.
- Every incident should be explainable.
- Every metric shown should have a derivation path.

## Scope guard
Not in v1 unless explicitly requested:
- autonomous remediation
- billing engine complexity
- enterprise SSO depth
- workflow builder
- dozens of integrations
- ClickHouse migration
- custom vector DB

## Primary docs
Read these before making structural changes:
- `docs/01-mvp-architecture-60-days.md`
- `docs/02-full-technical-build-spec.md`
- `docs/03-build-order-and-ownership.md`
