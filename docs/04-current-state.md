## current implemented state
- Reliai is now beyond the early foundation milestones documented here originally. The repo includes a working operator product loop across trace ingestion, trace graphs, evaluations, regressions, incidents, guardrails, deployment safety, and internal system dashboards.
- Public marketing and demo surfaces are implemented:
  - marketing homepage
  - interactive demo
  - failure playground
  - dedicated marketing screenshot routes
- First-party SDK packages exist in-repo:
  - Node SDK: `packages/reliai-node`
  - Python SDK: `packages/reliai-python`

## implemented product areas
- SDKs and runtime integration:
  - Python SDK
  - Node SDK
  - auto-instrumentation helpers for OpenAI, Anthropic, LangChain, and LlamaIndex
  - SDK telemetry events and runtime guardrail support
- Trace and investigation:
  - trace ingestion API
  - trace list/detail
  - trace graph and analysis APIs
  - replay helpers and replay snippets
- Reliability operations:
  - reliability metrics
  - regression detection
  - incident lifecycle
  - incident command center
  - investigation and compare flows
- Guardrails and deployments:
  - organization guardrail policies
  - control-panel guardrail coverage and recommendations
  - deployment simulations and safety gates
- Internal analytics:
  - growth dashboard
  - customer expansion dashboard
  - customer reliability dashboard
  - breakout-account detection and expansion metrics

## recent additions reflected in the repo
- Project control panel now includes traffic and live-system signals:
  - `Traces analyzed (24h)`
  - `traces/sec`
  - `Active services`
- Internal growth surfaces now include:
  - usage expansion ratio
  - breakout account detection
  - top expanding customers
  - cohort and customer-usage distribution charts
- Marketing screenshot system is now stabilized through:
  - screenshot-only compaction for the control-panel asset
  - panel-first screenshot capture with full-page fallback
  - Retina capture
  - deterministic mixed demo state
  - layout/readiness Playwright guards
  - CI drift detection for `apps/web/public/screenshots`

## verified commands
- `make test`
- `make test-integration`
- `make lint`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- `make db-migrate`
- `make seed`
- `docker compose up -d postgres redis`
- `pnpm screenshots:marketing`

## open risks
- Local/frontend build stability is not fully clean; recent local `pnpm --filter web build` runs have intermittently failed on unrelated Next.js route/page-data issues outside the screenshot slice.
- Postgres integration tests still require local Postgres availability and do not yet run as part of `make test`.
- The current marketing screenshot stability milestone intentionally does not include backend synthetic demo telemetry generation.

## next milestone plan
- Synthetic Demo Telemetry Generator:
  - generate richer agent-style demo traces
  - produce deeper multi-service trace graphs
  - keep marketing/demo telemetry meaningful without relying on customer data
- Continue extending evaluation depth:
  - relevance
  - groundedness
  - retrieval quality
- Keep hardening regression and incident workflows around the existing operator loop.

## future backlog
- [Milestone 21 — Trace Columnar Analytics Layer](/Users/robert/Documents/Reliai/docs/backlog/milestone-21-trace-analytics-layer.md): future-scale columnar warehouse plan for high-volume trace analytics once operational DB query limits are reached.
- [Milestone 22 — Control Plane Architecture](/Users/robert/Documents/Reliai/docs/backlog/milestone-22-control-plane-architecture.md): strategic architecture guardrail defining Reliai as a control plane over managed infrastructure layers.
- [Milestone 23 — Synthetic Demo Telemetry Generator](/Users/robert/Documents/Reliai/docs/backlog/milestone-23-synthetic-demo-telemetry-generator.md): later demo infrastructure for generating AI traces, tool spans, guardrail failures, and deployment regressions for demos, CI testing, and marketing screenshots.
