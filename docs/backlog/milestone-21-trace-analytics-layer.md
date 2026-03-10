# Reliai Backlog

# Milestone 21 — Trace Columnar Analytics Layer

Priority: **Future Scale Infrastructure**

Trigger conditions:

```text
> 100M traces stored
or
> 10k trace ingest/sec
or
> investigation queries > 1s latency
```

Purpose:

Introduce a **columnar analytics warehouse** for trace data so Reliai can scale to **billions of traces** without overloading the operational database.

This architecture is used by platforms such as:

- Datadog
- Honeycomb
- Snowflake

They separate:

```text
Operational DB
from
Analytical Query Storage
```

---

# Architecture Goal

Reliai will operate two distinct storage layers.

```text
Application Layer
        │
        ▼
Postgres (Operational DB)
        │
        │ async streaming
        ▼
Columnar Trace Warehouse
```

Postgres remains the **source of truth** for operational workflows.

Columnar storage handles **trace analytics and investigation queries**.

---

# Layer Responsibilities

## Operational Database (Postgres)

Postgres remains responsible for:

```text
organizations
projects
prompt_versions
model_versions
incidents
regressions
deployments
alerts
recent traces
```

Trace retention in Postgres:

```text
7–30 days
```

Primary use:

```text
API reads
incident lifecycle
write-heavy ingestion
```

---

## Columnar Trace Warehouse

All traces are streamed asynchronously into a columnar system.

Recommended engine:

- ClickHouse

Alternatives:

- Apache Druid
- BigQuery

ClickHouse is preferred because it provides:

```text
extremely high ingest throughput
sub-second aggregations
excellent compression
```

---

# Target Query Capability

The analytics warehouse should support queries such as:

```text
count failures by prompt_version
last 30 days
group by model_version
```

and

```text
trace latency distribution
model_version = gpt-4.1
prompt_version = v24
last 7 days
```

These queries must execute in **milliseconds** even at **hundreds of billions of rows**.

---

# Columnar Trace Schema

The warehouse will use an append-only event table.

Example schema:

```text
trace_events
-----------

timestamp
organization_id
project_id
trace_id

prompt_version_id
model_version_id

latency_ms
success
error_type

input_tokens
output_tokens
cost

structured_output_valid

retrieval_latency_ms
retrieval_chunks

metadata_json
```

Columnar compression drastically reduces storage cost.

---

# Ingestion Pipeline Architecture

```text
Application
   │
   ▼
Reliai ingestion API
   │
   ├── Postgres (recent traces)
   │
   ▼
Streaming Queue
   │
   ▼
ClickHouse ingestion
```

Recommended streaming layer:

- Apache Kafka
- Redpanda

Streaming ensures the API path remains **fast and reliable**.

---

# Codex Future Sprint Prompt

Save the following prompt for the sprint implementing this milestone.

---

### Codex Implementation Prompt

```text
Read first:

AGENTS.md
docs/02-full-technical-build-spec.md
docs/backlog/milestone-21-trace-analytics-layer.md

Goal:

Introduce a columnar analytics layer for trace data using ClickHouse.

This layer must support investigation queries at billions-of-trace scale.

--------------------------------------------------

PART 1 — Streaming Pipeline

Add trace streaming pipeline.

When traces are ingested:

1. write to Postgres (existing behavior)
2. publish trace event to stream

Create module:

services/trace_stream.py

Events emitted:

trace_ingested

Payload:

trace_id
project_id
timestamp
prompt_version_id
model_version_id
latency_ms
success
error_type
token_usage
cost
metadata

--------------------------------------------------

PART 2 — ClickHouse Integration

Create infrastructure module:

infra/clickhouse/

Include:

connection
table creation
insert helpers

Create table:

trace_events

Schema should match:

timestamp
organization_id
project_id
trace_id
prompt_version_id
model_version_id
latency_ms
success
error_type
input_tokens
output_tokens
cost
structured_output_valid
retrieval_latency_ms
retrieval_chunks
metadata_json

Use partitioning by:

toYYYYMM(timestamp)

--------------------------------------------------

PART 3 — Ingestion Worker

Create worker:

workers/clickhouse_ingest.py

Responsibilities:

consume trace events
batch insert into ClickHouse

Ensure:

idempotent writes
batch size 1000+
retry logic

--------------------------------------------------

PART 4 — Analytics Query Adapter

Create service:

services/trace_analytics.py

Functions:

get_trace_latency_distribution()
get_model_reliability_metrics()
get_prompt_failure_rates()

Queries must run against ClickHouse.

--------------------------------------------------

PART 5 — API Layer

Add endpoints:

GET /api/v1/analytics/models/reliability

GET /api/v1/analytics/prompts/failure-rates

These endpoints query ClickHouse.

--------------------------------------------------

PART 6 — Testing

Add tests:

tests/test_clickhouse_pipeline.py

Validate:

trace event streaming
ClickHouse ingestion
analytics query responses

--------------------------------------------------

Constraints:

avoid speculative abstractions
keep analytics read-only
do not remove Postgres traces yet
ensure tenant-safe queries
```

---

# Strategic Impact

When this milestone is complete, Reliai gains the ability to handle:

```text
billions of traces
petabytes of telemetry
large enterprise workloads
```

without slowing down incident investigation.

This architecture creates **long-term defensibility** because the resulting dataset becomes:

```text
AI reliability operational intelligence
```

that competitors cannot replicate.
