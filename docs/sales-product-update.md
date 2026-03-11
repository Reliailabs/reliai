# Reliai Product Update for Sales

Last updated: March 11, 2026

Maintenance rule:
- Update this file after each shipped milestone that changes product capabilities, operator workflows, SDK behavior, platform APIs, or enterprise controls.
- Keep claims limited to implemented functionality in the repo.

## Reliai: AI Reliability Control Plane

Reliai is an AI reliability control plane for production systems.

It helps engineering teams detect AI regressions, understand root causes, and apply guardrails or deployment fixes before issues impact users.

Reliai sits between:
- application runtime
- model infrastructure
- operators responsible for production AI systems

Its purpose is to detect and contain reliability failures in AI systems the same way modern observability platforms manage reliability for traditional services.

## Category definition

Reliai operates in a new category:

`AI reliability infrastructure`

Traditional observability tools track infrastructure failures.

Reliai detects AI behavior failures, such as:
- model regressions
- hallucination spikes
- latency explosions
- prompt failures
- retrieval breakdowns

and helps teams investigate and mitigate them.

## What Reliai is today

The implemented product loop is:

`trace -> evaluate -> detect regressions -> open incidents -> investigate -> recommend mitigations -> automate responses`

This is not a generic observability dashboard. The product is built around catching AI regressions before users do, understanding why they happened, and helping operators apply the right guardrails or deployment fixes before reliability issues spread.

## The Reliai Product Loop

Reliai runs a continuous reliability loop around production AI systems.

1. Capture executions
   Reliai ingests traces and spans from SDK instrumentation.

2. Detect regressions
   Reliability metrics and pattern mining identify behavioral failures.

3. Open incidents
   The system automatically opens incidents when reliability degrades.

4. Investigate root cause
   Operators explore trace graphs, deployments, and reliability patterns.

5. Apply mitigation
   Guardrails, deployment rollbacks, or policy enforcement contain the issue.

6. Learn from failures
   Reliability patterns feed deployment risk scoring and guardrail recommendations.

This loop turns AI reliability management into a continuous operational process rather than reactive debugging.

## Why teams use Reliai

Teams adopt Reliai when their AI systems move from experimentation into production.

The most common triggers are:
- users reporting inconsistent or hallucinated responses
- production prompts changing without clear reliability visibility
- model upgrades causing unexpected behavior changes
- incident investigations requiring manual trace inspection
- lack of guardrails to prevent runtime failures

Reliai provides:
- regression detection
- deployment risk analysis
- incident investigation tooling
- runtime guardrails
- operational intelligence

in a single control plane.

## Ideal users

Reliai is designed for teams running AI systems in production.

Typical users include:
- AI platform teams
- applied AI teams
- reliability engineers
- ML infrastructure teams

Typical environments include:
- AI copilots
- generative search
- AI assistants
- document analysis systems
- AI support agents

## Core operator workflows implemented

### 1. Trace ingestion and evaluation
- Fast trace ingestion API
- Structured output evaluation
- Derived event pipeline with `trace_ingested -> trace_evaluated`
- Environment-scoped traces for `production`, `staging`, and `development`
- Span-aware trace storage with first-class fields for:
  - `trace_id`
  - `span_id`
  - `parent_span_id`
  - `span_name`
  - `guardrail_policy`
  - `guardrail_action`
- Execution graph query API for span trees and parent-child relationships
- Trace analysis API for:
  - slowest span
  - largest token span
  - guardrail retry concentration
- Trace replay API for reconstructing sanitized pipeline steps from production executions

### 2. Regression and incident detection
- Reliability metrics and regression detection
- Incident lifecycle management
- Incident command center for active investigations
- Incident compare and investigation flows
- Trace pivots and compare views

### 3. Guardrails and runtime protection
- Runtime guardrail policies
- Organization-level guardrail policies distributed to SDK clients
- SDK policy sync and local policy cache
- Guardrail runtime events
- Policy-violation events on the event pipeline
- SDK-local runtime guardrail enforcement for:
  - structured output retry
  - latency retry
  - cost budget blocking
  - organization policy enforcement modes:
    - observe
    - warn
    - enforce
    - block
- Guardrail dashboard showing:
  - active protection coverage
  - trigger counts
  - recent interventions
  - span-level guardrail analytics

### 4. Deployment intelligence
- Deployment tracking
- Deployment risk scoring
- Deployment simulations
- Deployment safety gates with `ALLOW`, `WARN`, and `BLOCK` decisions
- Deployment gate API for CI/CD and release checks
- Deployment detail page with graph-backed reliability insights and recommended guardrails

### 5. Reliability intelligence
- Reliability pattern mining
- Reliability knowledge graph
- Cross-project reliability pattern store used by risk and recommendation engines
- Global reliability intelligence from anonymized cross-organization pattern mining
- Recommendation engine for deterministic operational fixes
- Intelligence integrated into:
  - project control panel
  - incident investigation
  - incident remediation surfaces
  - deployment detail

### 6. Automation
- Rule engine on top of the event pipeline
- Supported actions include:
  - create incident
  - send webhook
  - send Slack alert
  - trigger processor
  - recommend guardrail
  - rollback deployment
  - enable guardrail
  - increase sampling
  - disable processor
- Automation safety controls:
  - dry run
  - cooldown windows
  - max actions per hour
- Automatic reliability action audit trail

### 7. Extension platform
- Formal processor extension platform on top of the existing processor architecture
- Separate runtime paths for:
  - core processors
  - organization processors
  - platform extensions
- Organization extension install API with versioned runtime config
- Allowed-event and runtime-limit enforcement for installed extensions
- Extension health, recent errors, and hourly invocation tracking
### 8. SDK and developer integration
- Official Python SDK
- Official Node SDK
- Async batching for trace and guardrail event delivery
- Auto-instrumentation for provider/framework traffic
- Distributed trace context propagation across requests
- Span APIs for request, retrieval, LLM, guardrail, and post-processing stages
- Pipeline span helpers for:
  - retrieval
  - prompt build
  - LLM calls
  - tool execution
  - post-processing
- Runtime guardrails inside the SDK so Reliai can protect production flows locally, not only observe them
- Organization policy fetch endpoint used by SDK clients
- Replay helpers in Python and Node SDKs so engineers can reconstruct stored executions locally

### 9. Event-first processing architecture
- Canonical append-only `event_log`
- Immutable event-first processor pipeline
- Historical event replay worker for processor reprocessing
- Deterministic derived tables designed to be rebuildable from events
- Event pipeline telemetry with:
  - consumer throughput
  - consumer lag
  - error counts
  - dead-letter queue support

## Major product surfaces implemented

### Project surfaces
- Control Panel
  - answers: "Is this AI system safe right now?"
  - includes reliability score, recent changes, guardrail activity, guardrail compliance, automatic actions, and high-risk patterns
- Guardrail Dashboard
  - answers: "What is protecting production?"
- Trace detail
- Trace execution graph
- Trace replay snippets
- Timeline Investigation
- Reliability Scorecard
- Deployments
  - includes deployment safety check, gate reasons, and recommended fixes
- Regressions
- Ingestion control
- Processor configuration

### Incident surfaces
- Incident detail
- Incident command center
- Incident investigation
- Incident compare

### System / internal surfaces
- Growth dashboard
- Customer expansion dashboard
- Customer reliability dashboard
- Platform health dashboard
- Pipeline dashboard
- Intelligence dashboard
- Reliability patterns dashboard
- Extension operations dashboard

## Internal infrastructure growth metrics implemented

Reliai now includes an internal customer expansion metric derived from warehouse rollups.

This shows:
- first 30-day telemetry volume by customer organization
- current 30-day telemetry volume by customer organization
- expansion ratio
- breakout-customer detection when expansion exceeds 5x

This is an internal operating metric for identifying infrastructure-style account expansion from telemetry growth, not a customer-facing analytics feature.

## Intelligence now visible in operator workflows

Operators now see graph-backed intelligence in the places where they make decisions:

- Control panel
  - high-risk patterns
  - recommended guardrails
  - model failure signals
- Incident investigation
  - possible root causes
- Incident remediation
  - graph-related patterns
  - recommended mitigations
  - similar failures observed across the platform
- Deployment detail
  - graph risk patterns
  - risk explanations
  - recommended guardrails
  - deployment safety gate decision
  - recommended fixes before rollout
  - global reliability signals folded into risk scoring
- Trace graph
  - span tree
  - latency by span
  - guardrail actions on execution paths
  - slowest-span and token-heavy-span analysis
- Trace detail
  - replay payload
  - Python replay snippet
  - Node replay snippet

## Enterprise and platform capabilities implemented

### Authentication and access control
- WorkOS-based auth
- Dev-only fallback auth for local/test environments
- Enterprise RBAC
- Multi-organization membership
- Project-level membership
- System-admin-only internal dashboards

### Tenant and environment isolation
- Explicit organization boundaries
- Project-scoped authorization
- Environment-scoped data model and filtering
- Tenant-safe APIs and query paths

### Audit and governance
- Audit logging for key mutating actions
- Organization and project membership APIs
- Organization switching in session/UI
- Organization guardrail policy model and distribution API
- Organization-level guardrail compliance derived from runtime and warehouse signals

### Platform APIs
- Project-scoped ingest/runtime API keys
- Organization-scoped public API keys
- Customer export jobs
- SDK telemetry ingestion
- Platform extension install/list APIs on top of the processor system
- Trace graph API
- Global reliability patterns API
- Reliability patterns API
- Deployment safety gate API
- System platform metrics API
- System customer reliability API
- System event pipeline API
- Organization policy distribution API
- Support debug API

### Scalability foundations
- ClickHouse warehouse migrations
- Canonical trace warehouse schema
- First-class span and guardrail columns in the warehouse
- Hourly and daily rollup tables
- Query router with raw / rollup / archive separation
- Rollup boundary enforcement for long-window analytics
- Warehouse access control so analytics services route through the query router instead of reading warehouse tables directly
- Warehouse archive path
- Backpressure protection
- Scheduler for recurring workers
- Canonical append-only event log
- Historical event replay worker
- Event-first processor discipline with immutable events and rebuildable derived state

## Recent platform additions

The most recent implementation wave added:

- Incident command center for active incidents
- Event pipeline observability with throughput, lag, error counts, and DLQ routing
- External processor framework with signed delivery, retries, and failure logging
- Customer reliability operations dashboard and project drilldown
- Cross-project reliability pattern mining with operator-facing pattern dashboards
- Automatic reliability actions with audit logging and safety controls
- Organization-level guardrail policies with SDK sync and policy-violation events
- Guardrail compliance on the control panel
- Canonical append-only event log and historical replay path for processors
- Public marketing homepage with failure-led product story
- Interactive public demo and failure playground
- Frontend-only marketing screenshot routes and screenshot generators
- SDK install section for Python and Node directly on the homepage

## Marketing and developer onboarding

Reliai now includes a public developer onboarding surface designed to reduce friction for first-time evaluation.

### Marketing homepage

The marketing homepage now follows a failure-led infrastructure narrative:

- Hero
- Failure timeline
- Interactive demo
- Playground
- Product loop
- SDK install
- Architecture
- Final CTA

### Developer onboarding section

The homepage now includes an SDK install block directly below the hero:

`Install Reliai in 60 seconds`

Features highlighted:

- Auto instrumentation
- Distributed tracing
- Runtime guardrails
- Incident detection

Supported SDKs:

- Python
- Node

Each SDK tab includes:

- install command
- minimal example
- copy-to-clipboard support

This allows engineers to immediately see how to integrate Reliai without navigating to documentation.

### Playground

A public interactive playground allows visitors to simulate AI failures and observe how Reliai detects and mitigates them.

Supported failure scenarios:

- hallucination
- latency spike
- model regression
- retrieval failure

Each simulation walks through the Reliai reliability loop:

`failure -> incident -> trace analysis -> guardrail recommendation`

## Recommended demo flow

For a live demo, use this sequence:

1. Start at the control panel
   - explain: this answers the operator question, "Is my AI system safe right now?"
   - show:
     - reliability status
     - incidents
     - deployment risk
     - guardrails
     - recommended mitigations
2. Show guardrails protecting production
   - explain: guardrails are runtime protections that intervene when AI behavior becomes unsafe
   - show:
     - guardrail triggers
     - actions taken
     - production protection coverage
3. Open an incident
   - explain: Reliai automatically detects reliability regressions and opens incidents
   - show:
     - incident compare
     - trace pivots
     - investigation view
4. Show investigation intelligence
   - explain: the system analyzes reliability patterns and suggests likely causes
   - show:
     - root-cause hints
     - reliability graph signals
5. Show remediation
   - open the incident command center
   - explain: operators see the active incident status, root cause, trace comparison, deployment context, guardrail activity, and related regressions in one place
   - show:
     - guardrail recommendations
     - runtime protection suggestions
     - deployment context
     - related regressions
6. Show deployment risk
   - open deployment detail
   - explain: before shipping changes, teams can simulate and analyze reliability risk
   - show:
     - deployment risk score
     - deployment safety gate decision
     - reliability patterns
     - guardrail recommendations
7. Show execution graph
   - open trace graph from a trace detail
   - explain: Reliai can break an AI request into spans across retrieval, model calls, guardrails, and post-processing
   - show:
     - span tree
     - latency by span
     - guardrail intervention points
8. Show platform intelligence
   - open the system intelligence dashboard
   - explain: Reliai aggregates reliability intelligence across systems
9. Show platform operations depth
   - open the pipeline dashboard or customer reliability dashboard
   - explain: Reliai also gives internal operator teams visibility into pipeline health and customer-level reliability risk
   - show:
     - consumer lag and throughput
     - processor failures
     - customer risk levels
10. Show governance
   - explain: runtime policy can be distributed at the organization level, not just configured project by project
   - show:
     - organization policy distribution
     - control-panel guardrail compliance
     - policy-violation events

## Best positioning for sales conversations

Reliai should be positioned as:

`AI reliability control plane for production systems`

Reliai is the operational control plane that sits between AI systems and production users, detecting failures, explaining root causes, and enforcing guardrails before issues spread.

Current proof points:
- production-minded incident workflow
- deterministic guardrail and remediation recommendations
- deployment risk and simulation
- intelligence integrated into operator actions
- automatic but safety-bounded mitigation actions
- organization-level AI runtime policy enforcement
- event-first architecture for replay and scalable processing
- enterprise auth, RBAC, audit logging, and tenant isolation
- scalable warehouse and rollup architecture

## Why Reliai Is Different

### Why Reliai is different from LLM observability tools

Most AI observability platforms focus on:
- prompt analytics
- evaluation dashboards
- offline testing

Reliai focuses on production reliability operations.

Key differences:

| Traditional LLM observability | Reliai |
| --- | --- |
| Prompt analytics | Incident detection |
| Offline evaluation | Production guardrails |
| Dataset monitoring | Deployment safety gates |
| Model metrics | Reliability intelligence |

Reliai acts as the control plane for production AI reliability, not just an analytics dashboard.

## Important caveats

Use these in conversations to stay accurate:

- Reliai is strongest today for operator teams managing production AI systems, not generic LLM app analytics.
- The product already includes bounded automatic mitigation actions, but it should still be positioned as operator-controlled automation, not fully autonomous remediation.
- Some platform capabilities are internal/admin-first and best shown as roadmap leverage or enterprise readiness, not end-user workflow.

## Near-term narrative

The strongest sales story today is:

Reliai helps teams catch AI regressions before users do, understand likely causes, and take the right mitigation action using guardrails, deployment intelligence, graph-backed reliability signals, and safety-bounded automation across production AI systems.
