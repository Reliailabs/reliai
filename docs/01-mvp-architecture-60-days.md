# The Exact MVP Architecture for Building the First Version of the AI Reliability Platform in 60 Days

## Goal
Ship a narrow, real MVP that can be installed by design partners and used to detect AI production failures.

## v1 product promise
> Plug this into your AI app and quickly see when quality, latency, or cost is degrading.

## v1 wedge
Build only:
- AI request tracing
- output evaluations
- regression detection
- incident feed
- Slack/email/webhook alerting
- operator dashboard

Do not build a general AI ops suite in v1.

---

## Stack

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- lightweight charting

### Backend
- FastAPI
- Pydantic models
- SQLAlchemy ORM or SQLModel
- Alembic migrations

### Jobs
- RQ workers
- Redis queues

### Storage
- PostgreSQL for app data and trace metadata
- Redis for queueing, throttling, dedupe, and short-lived aggregation

### Auth
- Clerk or WorkOS AuthKit

### Hosting
- Vercel for frontend
- Render, Railway, Fly, or ECS/Fargate for API + workers
- managed Postgres
- managed Redis

---

## Core components

### 1. Ingestion API
Receives traces and stores them.

Input examples:
- model name
- provider
- prompt version
- input
- output
- latency
- token usage
- estimated cost
- retrieval metadata
- success/failure

### 2. Evaluation workers
Run async checks against traces.

Prioritized evals:
- structured output validity
- answer relevance
- groundedness for RAG
- retrieval quality
- safety flags

### 3. Regression engine
Compares current windows to baseline windows.

Detects:
- latency spikes
- quality drops
- cost jumps
- prompt regressions
- model regressions
- retrieval degradation

### 4. Incident engine
Creates operator-facing incidents from meaningful negative changes.

Each incident must answer:
- what changed
- when it started
- what dimension is affected
- what model or prompt is implicated
- which traces are examples

### 5. Alerting service
Sends:
- Slack notifications
- email notifications
- webhooks

### 6. Dashboard
Four main views:
- overview
- traces
- incidents
- alerts/settings

---

## High-level architecture

```text
Customer AI App
  -> SDK / ingest endpoint
  -> FastAPI ingestion API
  -> PostgreSQL
  -> Redis queue
  -> RQ workers
  -> evaluations + regression analysis
  -> incidents + alerts
  -> dashboard API
  -> Next.js operator UI
```

---

## Key MVP features to prioritize

### Must-have
1. trace ingestion
2. trace viewer
3. async evaluations
4. regression detection
5. incident creation
6. Slack alerts
7. overview dashboard

### Nice-to-have only if ahead of schedule
- email alerts
- webhook alerts
- prompt diffing UI
- usage limits
- billing placeholder

### Not in v1
- autonomous remediation
- deep RBAC
- enterprise SSO depth
- model routing recommendations
- ClickHouse event storage
- canary releases

---

## 60-day execution plan

### Days 1-7
- repo setup
- auth
- org/project model
- API key issuance
- ingestion endpoint
- first trace persisted
- dashboard shell

### Days 8-14
- trace list screen
- trace detail screen
- filtering by project/model/prompt/environment
- token/cost/latency display

### Days 15-24
- worker queue
- evaluations storage
- structured output eval
- relevance eval
- groundedness eval

### Days 25-32
- baseline calculation
- regression logic
- score aggregation
- project-level reliability score

### Days 33-40
- incident creation rules
- incident feed UI
- Slack alerts
- email alerts

### Days 41-50
- Python SDK
- Node SDK
- onboarding docs
- demo seed mode
- install flow cleanup

### Days 51-60
- polish critical UI states
- improve incident context
- stabilize jobs
- bug fixes
- design partner readiness

---

## Team needed for MVP

### Product + Architecture
Owns:
- product framing
- data model integrity
- incident and metric definitions
- endpoint and service boundaries
- roadmap discipline

### Full-stack engineer
Owns:
- Next.js app
- auth integration
- dashboard pages
- settings and onboarding UI
- API integration layer

### Platform/backend engineer
Owns:
- ingestion API
- worker queue
- evaluations
- regression engine
- incidents and alerts
- operational deployment

### Designer
Owns:
- operator UX
- information architecture
- empty/loading/error states
- setup flow clarity
- visual quality without generic SaaS design

---

## Launch positioning
Use sharp language:
- SRE for AI apps
- catch AI regressions before users do
- reliability monitoring for LLM and RAG apps

Avoid vague platform claims.
