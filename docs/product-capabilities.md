# Reliai Product Capabilities Index

Last updated: March 13, 2026

Maintenance rule:
- This document must be updated whenever new platform capabilities, APIs, SDK functionality, or operator workflows are introduced.
- Keep it as the authoritative internal index of implemented platform capabilities.

## Platform Category

AI reliability infrastructure

Reliai provides the operational control plane for production AI systems.

## 1. SDK and Runtime Integration

### Python SDK

Capabilities:
- trace ingestion
- span instrumentation
- distributed trace context propagation
- runtime guardrails
- organization policy synchronization
- trace replay helper
- pipeline spans
- auto-instrumentation helpers for OpenAI, Anthropic, LangChain, and LlamaIndex

Supported span types:

- retrieval
- prompt_build
- llm_call
- tool_call
- postprocess

Guardrails supported:

- structured_output
- latency_retry
- cost_budget

### Node SDK

Capabilities:
- async batching
- span instrumentation
- distributed trace propagation
- runtime guardrails
- replay helpers
- pipeline spans
- auto-instrumentation helpers for OpenAI, Anthropic, LangChain, and LlamaIndex

## 2. Trace Infrastructure

### Trace ingestion

Capabilities:
- high-volume trace ingest
- environment scoping
- span-aware traces

Fields:

- trace_id
- span_id
- parent_span_id
- span_name
- guardrail_policy
- guardrail_action

### Trace graph

Capabilities:
- execution graph
- latency attribution
- token attribution
- guardrail retry detection

Endpoints:

- `GET /api/v1/traces/{trace_id}/graph`
- `GET /api/v1/traces/{trace_id}/analysis`

## 3. Incident Detection

Capabilities:
- regression detection
- incident lifecycle
- incident compare
- investigation surfaces
- command center

## 4. Guardrails

Runtime protections:

- structured output enforcement
- latency retry
- cost budget
- organization policy enforcement

Guardrail telemetry:

- policy violation events
- guardrail triggers
- coverage metrics

## 5. Deployment Safety

Capabilities:

- deployment tracking
- deployment simulation
- deployment safety gates
- CI/CD gate API

Gate outputs:

- ALLOW
- WARN
- BLOCK

## 6. Reliability Intelligence

Systems:

- reliability pattern mining
- reliability knowledge graph
- cross-project pattern store
- global reliability intelligence

Data sources:

- trace warehouse
- incident history
- deployment events

## 7. Event-First Architecture

Canonical event log:

- `event_log`

Properties:

- append-only
- immutable
- replayable

Workers:

- event replay
- processor dispatch
- derived table rebuild

## 8. Platform Extensions

Extension runtime supports:

- core processors
- organization processors
- platform extensions

Capabilities:

- event subscriptions
- runtime limits
- versioning
- health tracking

## 9. Warehouse and Analytics

Storage systems:

- ClickHouse warehouse
- Postgres operational DB

Analytics capabilities:

- hourly rollups
- daily rollups
- customer expansion metrics
- reliability metrics
- breakout-account detection
- cohort expansion analytics

## 10. Developer Experience

Public developer surfaces:

- interactive demo
- failure playground
- SDK install section
- screenshot routes

Developer workflows:

- SDK install
- trace replay
- trace debugging
- guardrail configuration
- deployment safety checks

## 11. Internal System Dashboards

System surfaces include:

- customer expansion dashboard
- growth dashboard
- platform health dashboard
- pipeline observability
- reliability patterns dashboard
- extension operations dashboard

## Detailed Capability Inventory

### SDK and runtime integration

Python SDK:
- trace ingestion
- span instrumentation
- distributed trace context propagation
- runtime guardrails
- organization policy sync
- trace replay helper
- pipeline spans
- auto-instrumentation helpers for OpenAI, Anthropic, LangChain, and LlamaIndex

Node SDK:
- async batching
- span instrumentation
- distributed trace propagation
- runtime guardrails
- replay helpers
- pipeline spans
- auto-instrumentation helpers for OpenAI, Anthropic, LangChain, and LlamaIndex

### Trace infrastructure

Trace ingestion:
- high-volume trace ingest
- environment scoping
- span-aware traces
- canonical trace event schema
- immutable event validation at ingest

Trace graph:
- execution graph
- latency attribution
- token attribution
- guardrail retry detection
- trace analysis API

Replay:
- trace replay snippets in UI
- replay helper support in SDKs
- sanitized execution reconstruction

### Incident detection and investigation

Capabilities:
- reliability metrics and regression detection
- incident lifecycle management
- incident compare
- incident investigation
- incident command center
- root-cause hints
- related regression linking
- control-panel system health and traffic grouping

### Guardrails and runtime protection

Runtime protections:
- structured output enforcement
- latency retry
- cost budget protection
- organization policy enforcement
- policy enforcement modes: observe, warn, enforce, block

Telemetry:
- policy violation events
- guardrail runtime events
- trigger counts
- coverage metrics
- span-level guardrail analytics

### Deployment safety

Capabilities:
- deployment tracking
- deployment simulations
- deployment risk scoring
- deployment safety gates
- graph-backed deployment intelligence
- recommended guardrails before rollout

Gate outputs:
- ALLOW
- WARN
- BLOCK

### Reliability intelligence

Systems:
- reliability pattern mining
- reliability graph / knowledge graph
- cross-project pattern store
- global reliability intelligence
- recommendation engine

Used by:
- deployment risk engine
- simulation surfaces
- incident investigation
- remediation recommendations
- control panel risk surfacing

### Event-first architecture

Canonical store:
- append-only `event_log`

Processor architecture:
- immutable events
- dispatcher-based fanout
- replay worker
- derived state intended to be rebuildable

Pipeline observability:
- throughput
- lag
- error counts
- dead-letter queue support

### Platform extensions and processors

Capabilities:
- extension install/list APIs
- organization processors
- platform extension runtime config
- allowed-event enforcement
- runtime limits
- health and recent error tracking
- external processors with signed delivery, retries, and failure logging

### Warehouse and analytics

Storage:
- ClickHouse warehouse
- Postgres operational database

Analytics:
- hourly rollups
- daily rollups
- customer expansion metrics
- customer reliability metrics
- growth metrics
- breakout-account detection events
- usage expansion cohort curves
- customer usage distribution charts
- warehouse query router
- archive path
- warehouse access control

### Developer experience and marketing surfaces

Public surfaces:
- marketing homepage
- interactive demo
- failure playground
- screenshot routes
- SDK install section
- screenshot stability CI protections

Developer workflows:
- SDK install
- trace replay
- trace debugging
- guardrail configuration
- deployment safety checks
- failure simulation in playground
- screenshot regeneration and drift review

### Internal system dashboards

Internal operator surfaces:
- customer expansion dashboard
- growth dashboard
- customer reliability dashboard
- platform health dashboard
- pipeline observability dashboard
- intelligence dashboard
- reliability patterns dashboard
- extension operations dashboard

### Control panel and growth surfaces

Project control panel:
- reliability score
- active incidents
- guardrails protecting
- traces analyzed (24h)
- traces per second
- active services
- recommended operator guidance

Growth dashboard:
- top expanding customers
- median expansion ratio
- top expansion ratio
- breakout accounts detected
- total telemetry (30d)
- usage expansion cohort chart
- customer usage distribution chart

### Marketing screenshot stability

Capabilities:
- panel-first control-panel screenshot capture
- screenshot-only control-panel compaction
- hybrid fallback to full-page capture
- Retina screenshot generation
- deterministic mixed demo state for screenshots
- Playwright layout regression check
- Playwright readiness guard
- CI screenshot drift detection for `apps/web/public/screenshots`

### Governance, auth, and tenancy

Capabilities:
- WorkOS auth integration
- dev fallback auth for local environments
- RBAC
- multi-organization membership
- project-scoped membership
- system-admin-only internal surfaces
- tenant-safe APIs
- environment-scoped filtering
- audit logging
- organization guardrail policies

## Why This Separation Exists

The sales document answers:

- What does Reliai do?
- Why should a company buy it?

This capabilities document answers:

- What does the platform actually contain?
- Which APIs, SDK features, and operator workflows exist today?

Use this file for:

- product planning
- roadmap management
- onboarding engineers
- investor diligence
- documentation alignment
