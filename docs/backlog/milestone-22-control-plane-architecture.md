# Reliai Backlog

# Milestone 22 — Control Plane Architecture

Priority: **Strategic Architecture**

Purpose:

Ensure Reliai follows the **Control Plane + Managed Infrastructure architecture pattern** used by companies such as:

- Snowflake
- Datadog
- Cloudflare
- Vercel

These companies scale to **$100M+ ARR with small engineering teams** because they build:

```text
a small intelligent control plane
that orchestrates large managed infrastructure layers
```

Reliai must follow the same architecture.

---

# Architecture Goal

Reliai should act as an **AI Reliability Control Plane**.

```text
Customer AI System
        │
        ▼
Reliai Control Plane
        │
        ├── Trace ingestion
        ├── Incident engine
        ├── Deployment intelligence
        ├── Guardrail runtime
        └── Root cause analysis
        │
        ▼
Managed Infrastructure Layer
```

The **control plane is the product**.

The **infrastructure layers are composed services**.

---

# Layer Responsibilities

## Layer 1 — Control Plane (Reliai Core Product)

The control plane must contain only **product intelligence**.

Current Reliai components already include:

```text
traces
evaluation_rollups
regression_snapshots
incidents
incident_events
deployments
prompt_versions
model_versions
compare analysis
registry
alert delivery
```

Control plane responsibilities:

```text
policy logic
investigation graph
incident lifecycle
root cause analysis
alert routing
deployment correlation
guardrail policy management
```

Constraint:

```text
core product logic should remain <100k LOC
```

The control plane should **not implement infrastructure primitives**.

---

## Layer 2 — Event Ingestion Pipeline

Reliai should rely on **managed streaming infrastructure**.

Recommended stack:

- Apache Kafka
- Redpanda

Architecture:

```text
Trace ingestion API
        │
        ▼
Streaming layer
        │
        ▼
Event processors
```

Events emitted:

```text
trace_ingested
deployment_created
regression_detected
incident_opened
alert_sent
```

All heavy workflows should be **event-driven**.

---

## Layer 3 — Trace Analytics Warehouse

Reliai must use a **columnar analytics system** for trace analytics.

Recommended engine:

- ClickHouse

This system stores:

```text
historical traces
reliability metrics
model performance
prompt evolution
```

The control plane should **query the warehouse for analytics**.

---

## Layer 4 — Worker Compute Layer

All heavy compute should run in **background workers**, not API servers.

Typical stack:

```text
RQ / Celery / Temporal
```

Worker responsibilities:

```text
evaluation rollups
regression detection
incident analysis
root cause analysis
deployment correlation
analytics aggregation
```

This ensures:

```text
API layer remains lightweight
system remains resilient to worker failures
```

---

## Layer 5 — Guardrail Runtime

Reliai should provide a runtime layer that sits in the **AI request path**.

Architecture:

```text
Application
   │
   ▼
Reliai Guardrail SDK
   │
   ▼
LLM Provider
```

Guardrail responsibilities:

```text
structured output validation
hallucination checks
model fallback
latency enforcement
cost guardrails
```

This creates **mission-critical lock-in**.

---

## Layer 6 — Reliability Intelligence Network

Once multiple organizations use Reliai, the platform can aggregate **global reliability intelligence**.

Example insights:

```text
model reliability scores
prompt failure patterns
latency degradation signals
retrieval failure clusters
```

This becomes a **network-effect moat**.

---

# Infrastructure Delegation Strategy

Reliai should **not build its own infrastructure primitives**.

Delegation model:

| Component | Managed By |
| --- | --- |
| Control plane | Reliai |
| Streaming | Kafka / Redpanda |
| Analytics DB | ClickHouse |
| Object storage | S3 |
| Compute | Kubernetes |
| CDN | Cloudflare |

Reliai engineers should focus on:

```text
reliability intelligence
incident automation
root cause analysis
deployment safety
```

---

# Engineering Principles

Reliai development must follow these rules.

## Rule 1 — Never Build Infrastructure Primitives

Avoid building:

```text
queue systems
databases
stream processors
search engines
```

Use existing infrastructure.

---

## Rule 2 — Maintain a Single Source of Truth

Control plane owns:

```text
incidents
regressions
deployments
reliability graph
```

Everything else is **derived data**.

---

## Rule 3 — Everything Is an Event

System workflows should be event-driven.

Example events:

```text
trace_ingested
deployment_created
regression_detected
incident_opened
alert_sent
```

---

## Rule 4 — Optimize for Investigation Speed

The system should allow engineers to answer:

```text
why did this break?
```

in seconds.

---

## Rule 5 — Avoid Feature Sprawl

Reliai’s core mission is:

```text
AI Reliability Control Plane
```

Not a general-purpose observability platform.

---

# Codex Implementation Prompt

When implementing this milestone, Codex should enforce architectural boundaries.

---

### Codex Prompt

```text
Read first:

AGENTS.md
docs/02-full-technical-build-spec.md
docs/backlog/milestone-22-control-plane-architecture.md

Goal:

Refactor the Reliai architecture to explicitly enforce the Control Plane model.

The Reliai control plane must orchestrate infrastructure layers but must not implement infrastructure primitives.

--------------------------------------------------

PART 1 — Architecture Documentation

Create:

docs/architecture/control-plane-architecture.md

Document:

control plane responsibilities
infrastructure delegation
event-driven architecture
service boundaries

--------------------------------------------------

PART 2 — Event Schema

Create shared event schema module:

packages/events/

Define events:

trace_ingested
deployment_created
regression_detected
incident_opened
alert_sent

Each event should contain:

event_id
event_type
timestamp
organization_id
project_id
payload_json

--------------------------------------------------

PART 3 — Event Emission

Update services to emit events.

Services affected:

trace ingestion
deployment service
incident service
regression detection

Events must be emitted asynchronously.

--------------------------------------------------

PART 4 — Worker Event Consumers

Create worker modules that subscribe to events.

Example workers:

analytics_aggregator
incident_analysis_worker
root_cause_worker

Workers must operate asynchronously.

--------------------------------------------------

PART 5 — Infrastructure Abstraction

Create module:

infra/providers/

Adapters for:

streaming provider
analytics database
object storage

These adapters allow infrastructure to be swapped without changing control plane logic.

--------------------------------------------------

PART 6 — Tests

Add:

tests/test_event_system.py

Validate:

event emission
event schema validation
worker consumption
tenant safety

--------------------------------------------------

Constraints:

do not build custom queue systems
use pluggable adapters for infrastructure
keep control plane services deterministic
avoid speculative abstractions
```

---

# Strategic Outcome

Once this milestone is implemented, Reliai becomes:

```text
AI Reliability Control Plane
+
AI Operational Intelligence Platform
```

This architecture enables Reliai to scale to:

```text
billions of traces
thousands of organizations
petabytes of telemetry
```

while keeping the engineering team small.
