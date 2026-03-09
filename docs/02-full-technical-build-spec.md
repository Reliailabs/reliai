# AI Reliability Platform MVP — Full Technical Build Spec

## 1. Product summary
Build a multi-tenant SaaS platform that lets teams instrument AI requests, evaluate outputs, detect regressions, create incidents, and notify operators.

Primary v1 use cases:
- RAG quality monitoring
- prompt/version regression detection
- structured output reliability
- latency and cost degradation monitoring

## 2. Monorepo structure

```text
ai-reliability/
  AGENTS.md
  README.md
  docs/
    01-mvp-architecture-60-days.md
    02-full-technical-build-spec.md
    03-build-order-and-ownership.md
  skills/
    product-architecture.md
    fullstack-engineer.md
    platform-backend-engineer.md
    designer.md
  apps/
    web/
      app/
      components/
      lib/
      hooks/
      styles/
      public/
      package.json
    api/
      app/
        api/
        core/
        db/
        models/
        schemas/
        services/
        workers/
        tasks/
        alerts/
        evals/
        regressions/
      alembic/
      tests/
      requirements.txt
    worker/
      runner.py
      jobs/
      requirements.txt
  packages/
    sdk-python/
    sdk-node/
    ui/
    config/
  infra/
    docker/
    terraform/
    deploy/
  scripts/
  .env.example
  docker-compose.yml
```

## 3. Service boundaries

### apps/web
Responsibility:
- authenticated operator app
- onboarding flow
- overview, traces, incidents, alerts, settings
- marketing site can exist later, but product app comes first

### apps/api
Responsibility:
- public ingestion API
- authenticated product APIs
- project/API key management
- incident querying
- alert rule management
- evaluation result access
- aggregate metrics

### apps/worker
Responsibility:
- process queued evaluation jobs
- run scheduled regression scans
- dedupe incident creation
- dispatch alerts

### packages/sdk-python and packages/sdk-node
Responsibility:
- instrumentation helpers
- direct ingest helper
- lightweight wrappers for capturing trace events

---

## 4. Suggested environment variables

```env
APP_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
INGEST_SIGNING_SECRET=
SLACK_WEBHOOK_DEFAULT=
EMAIL_FROM=
RESEND_API_KEY=
LLM_EVAL_PROVIDER=openai
LLM_EVAL_MODEL=gpt-4.1-mini
ENCRYPTION_KEY=
```

---

## 5. Database schema

Use PostgreSQL with UUID primary keys and timestamp columns on every entity.

### 5.1 organizations
Purpose: tenant root.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| slug | text unique | human-readable identifier |
| plan | text | free, pilot, growth, enterprise |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5.2 organization_members
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organization_id | uuid fk | |
| auth_user_id | text | maps to auth provider |
| role | text | owner, admin, member |
| created_at | timestamptz | |

### 5.3 projects
Purpose: scoped applications/environments within org.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organization_id | uuid fk | |
| name | text | |
| slug | text | unique per org |
| environment | text | prod, staging, dev |
| description | text null | |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5.4 api_keys
Store hash only, never plaintext after creation.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| key_prefix | text | visible prefix |
| key_hash | text | hashed secret |
| label | text | |
| last_used_at | timestamptz null | |
| revoked_at | timestamptz null | |
| created_at | timestamptz | |

### 5.5 prompt_versions
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| version | text | e.g. v12 |
| label | text null | |
| notes | text null | |
| created_at | timestamptz | |

### 5.6 model_versions
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| provider | text | openai, anthropic, bedrock |
| model_name | text | |
| model_version | text null | provider-specific |
| created_at | timestamptz | |

### 5.7 traces
Core request record.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organization_id | uuid fk | denormalized for filtering |
| project_id | uuid fk | |
| request_id | text | external correlation id |
| user_id | text null | end-user identifier |
| session_id | text null | |
| environment | text | repeated for fast filters |
| provider | text | |
| model_name | text | |
| model_version | text null | |
| prompt_version | text null | |
| input_text | text null | may be redacted later |
| output_text | text null | may be redacted later |
| input_preview | text null | safe truncated summary |
| output_preview | text null | safe truncated summary |
| latency_ms | integer | |
| prompt_tokens | integer null | |
| completion_tokens | integer null | |
| total_tokens | integer null | |
| estimated_cost_usd | numeric(12,6) null | |
| status | text | success, error |
| error_type | text null | timeout, provider_error, validation_error |
| source_type | text | llm, rag, agent, workflow |
| metadata_json | jsonb | free-form but bounded |
| created_at | timestamptz | ingestion timestamp |

Indexes:
- `(project_id, created_at desc)`
- `(organization_id, created_at desc)`
- `(project_id, prompt_version, created_at desc)`
- `(project_id, model_name, created_at desc)`

### 5.8 retrieval_spans
For RAG traces only.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| trace_id | uuid fk unique | one row for v1 |
| retrieval_latency_ms | integer null | |
| source_count | integer null | |
| top_k | integer null | |
| query_text | text null | |
| retrieved_chunks_json | jsonb | chunk refs or summaries |
| created_at | timestamptz | |

### 5.9 evaluations
One row per eval type per trace.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| trace_id | uuid fk | |
| project_id | uuid fk | |
| eval_type | text | structured_validity, relevance, groundedness, retrieval_quality, safety |
| score | numeric(5,2) null | normalized 0-100 if numeric |
| label | text null | pass, fail, warning |
| explanation | text null | concise operator-facing summary |
| evaluator_provider | text null | |
| evaluator_model | text null | |
| evaluator_version | text null | internal evaluator version |
| raw_result_json | jsonb | stores judge/raw details |
| created_at | timestamptz | |

Unique constraint:
- `(trace_id, eval_type)` for v1

### 5.10 metric_rollups_hourly
Materialized summary table produced by workers.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organization_id | uuid fk | |
| project_id | uuid fk | |
| bucket_start | timestamptz | hour start |
| request_count | integer | |
| error_count | integer | |
| avg_latency_ms | numeric(10,2) | |
| p95_latency_ms | numeric(10,2) | |
| avg_cost_usd | numeric(12,6) null | |
| relevance_avg | numeric(5,2) null | |
| groundedness_avg | numeric(5,2) null | |
| validity_pass_rate | numeric(5,2) null | |
| retrieval_quality_avg | numeric(5,2) null | |
| created_at | timestamptz | |

Unique constraint:
- `(project_id, bucket_start)`

### 5.11 incidents
Operator-facing reliability events.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organization_id | uuid fk | |
| project_id | uuid fk | |
| incident_type | text | latency_regression, relevance_drop, cost_spike, validity_failure, retrieval_degradation |
| severity | text | critical, high, medium, low |
| title | text | |
| description | text | human-readable summary |
| fingerprint | text | dedupe key |
| status | text | open, acknowledged, resolved |
| baseline_window_start | timestamptz null | |
| comparison_window_start | timestamptz null | |
| metric_name | text | |
| metric_baseline_value | numeric(12,4) null | |
| metric_current_value | numeric(12,4) null | |
| percent_change | numeric(8,2) null | |
| suspected_dimension | text null | prompt_version, model_name, environment |
| suspected_value | text null | e.g. v23 |
| trace_sample_ids | jsonb | up to N trace ids |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |
| resolved_at | timestamptz null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique/Index:
- unique `(project_id, fingerprint, status)` may be too strict; prefer unique on open fingerprint only in logic
- index `(project_id, status, first_seen_at desc)`

### 5.12 incident_events
Timeline/history for incident status changes and alert actions.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| incident_id | uuid fk | |
| event_type | text | created, alerted, acknowledged, resolved, reopened |
| payload_json | jsonb | |
| created_at | timestamptz | |

### 5.13 alert_channels
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| channel_type | text | slack, email, webhook |
| label | text | |
| target | text | webhook URL or email |
| is_active | boolean | |
| secret_encrypted | text null | for signed webhooks if needed |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5.14 alert_rules
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| incident_type | text | or wildcard |
| min_severity | text | |
| channel_id | uuid fk | |
| cooldown_minutes | integer | dedupe |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5.15 onboarding_checklists
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid fk | |
| sdk_installed | boolean | |
| first_trace_received | boolean | |
| alerts_configured | boolean | |
| first_incident_seen | boolean | |
| updated_at | timestamptz | |

---

## 6. API design

Base path: `/api/v1`

### 6.1 auth/session
#### GET `/auth/me`
Returns current org membership context.

Response:
```json
{
  "user": {"id": "...", "email": "..."},
  "organizations": [{"id": "...", "name": "Acme", "role": "owner"}],
  "activeOrganizationId": "..."
}
```

### 6.2 organizations
#### GET `/organizations`
List organizations for current user.

#### POST `/organizations`
Create organization.

### 6.3 projects
#### GET `/organizations/{organization_id}/projects`
List projects.

#### POST `/organizations/{organization_id}/projects`
Create project.

Request:
```json
{
  "name": "Support Copilot",
  "environment": "prod",
  "description": "Customer-facing LLM support workflow"
}
```

#### GET `/projects/{project_id}`
Project details + onboarding state.

#### PATCH `/projects/{project_id}`
Update project.

### 6.4 api keys
#### POST `/projects/{project_id}/api-keys`
Create API key and return plaintext once.

Response:
```json
{
  "id": "...",
  "label": "prod-ingest",
  "keyPrefix": "airp_live_abc",
  "plainTextKey": "airp_live_abc_..."
}
```

#### GET `/projects/{project_id}/api-keys`
List keys.

#### POST `/projects/{project_id}/api-keys/{key_id}/revoke`
Revoke key.

### 6.5 ingestion
Public authenticated via API key.

#### POST `/ingest/traces`
Accept a trace event.

Request:
```json
{
  "projectApiKey": "airp_live_...",
  "requestId": "req_123",
  "userId": "u_123",
  "sessionId": "s_456",
  "environment": "prod",
  "provider": "openai",
  "modelName": "gpt-4.1",
  "modelVersion": "2026-01-15",
  "promptVersion": "v12",
  "sourceType": "rag",
  "inputText": "User asked for refund policy",
  "outputText": "...",
  "latencyMs": 1240,
  "promptTokens": 822,
  "completionTokens": 201,
  "totalTokens": 1023,
  "estimatedCostUsd": 0.0412,
  "status": "success",
  "metadata": {"route": "support/refund"},
  "retrieval": {
    "retrievalLatencyMs": 220,
    "sourceCount": 4,
    "topK": 6,
    "queryText": "refund policy",
    "retrievedChunks": [
      {"id": "doc_1", "title": "Refund Policy", "score": 0.81}
    ]
  }
}
```

Response:
```json
{
  "traceId": "...",
  "queuedEvaluations": true
}
```

### 6.6 traces
#### GET `/projects/{project_id}/traces`
Supports filters:
- `from`
- `to`
- `modelName`
- `promptVersion`
- `status`
- `sourceType`
- `incidentId`
- `cursor`
- `limit`

#### GET `/traces/{trace_id}`
Returns trace detail, retrieval span, evaluations.

### 6.7 overview metrics
#### GET `/projects/{project_id}/overview`
Returns headline metrics for selected date window.

Response:
```json
{
  "window": {"from": "...", "to": "..."},
  "headline": {
    "reliabilityScore": 82,
    "requestCount": 12984,
    "errorRate": 1.9,
    "avgCostUsd": 0.038,
    "p95LatencyMs": 2140
  },
  "timeseries": {
    "latency": [...],
    "cost": [...],
    "reliability": [...],
    "incidents": [...]
  },
  "topFailures": [
    {"dimension": "promptVersion", "value": "v12", "issue": "relevance drop", "delta": -18.4}
  ]
}
```

### 6.8 incidents
#### GET `/projects/{project_id}/incidents`
Filters:
- `status`
- `severity`
- `incidentType`
- `from`
- `to`

#### GET `/incidents/{incident_id}`
Return incident detail + linked sample traces + event history.

#### POST `/incidents/{incident_id}/acknowledge`
#### POST `/incidents/{incident_id}/resolve`
#### POST `/incidents/{incident_id}/reopen`

### 6.9 alerts
#### GET `/projects/{project_id}/alert-channels`
#### POST `/projects/{project_id}/alert-channels`
#### PATCH `/alert-channels/{channel_id}`
#### GET `/projects/{project_id}/alert-rules`
#### POST `/projects/{project_id}/alert-rules`
#### PATCH `/alert-rules/{rule_id}`

### 6.10 onboarding
#### GET `/projects/{project_id}/onboarding`
#### POST `/projects/{project_id}/onboarding/refresh`
Recompute checklist from current data.

---

## 7. Worker jobs and scheduled tasks

### Queue names
- `evals`
- `regressions`
- `alerts`
- `maintenance`

### Jobs

#### `evaluate_trace(trace_id)`
Runs all configured v1 evals.
Stores `evaluations` rows.

#### `refresh_hourly_rollups(project_id, bucket_start)`
Aggregates traces/evals into `metric_rollups_hourly`.

#### `scan_project_regressions(project_id, window_end)`
Compares current window vs baseline and emits candidate incidents.

#### `create_or_update_incident(project_id, fingerprint, payload)`
Dedupes incidents and updates `last_seen_at`.

#### `dispatch_incident_alerts(incident_id)`
Evaluates matching rules, cooldowns, and sends notifications.

#### `refresh_onboarding_checklist(project_id)`
Updates checklist booleans from project state.

### Schedules
- every minute: process due alert dispatch jobs
- every 5 minutes: scan regressions for active prod projects
- every hour: compute rollups for previous bucket
- daily: retention cleanup and stale incident maintenance

---

## 8. Evaluation design

### v1 evaluation types

#### structured_validity
Use schema/rule validation when a structured response is expected.
Output:
- pass/fail
- invalid fields
- schema mismatch notes

#### relevance
LLM judge or rule-based heuristic.
Question:
- does the answer address the user request?

#### groundedness
For RAG traces.
Question:
- is the answer supported by retrieved context?

#### retrieval_quality
Judge whether retrieved chunks appear relevant to the query.

#### safety
Basic flags for risky output patterns.

### Score normalization
- numeric scores should normalize to 0-100
- pass/fail metrics should also map to a label
- explanation must be concise and operator-readable

---

## 9. Reliability score formula for v1

A simple weighted score is enough.

Example:
- 35% evaluation pass rate
- 25% latency health
- 20% error rate health
- 20% cost stability

Return integer 0-100.

Do not overclaim scientific precision. This is an operator signal, not a universal truth score.

---

## 10. Regression rules for v1

### latency regression
Trigger if:
- current p95 latency > baseline p95 by 30%+
- minimum request threshold met

### relevance drop
Trigger if:
- relevance average falls by 15+ points
- at least N evaluated traces in current window

### groundedness drop
Trigger if:
- groundedness falls by 15+ points

### validity failure
Trigger if:
- structured validity pass rate falls below 95%
- or drops by 5+ points relative to baseline

### cost spike
Trigger if:
- avg cost/request increases 25%+

### retrieval degradation
Trigger if:
- retrieval quality falls by 15+ points
- or retrieval latency jumps by 30%+

Each rule should record:
- baseline value
- current value
- percent change
- suspected dimension if one stands out

---

## 11. Incident fingerprinting

Use a deterministic fingerprint such as:

```text
{project_id}:{incident_type}:{suspected_dimension}:{suspected_value}:{window_bucket}
```

Use this to avoid duplicate open incidents for the same active problem.

---

## 12. Alerting behavior

### Slack
Message should include:
- severity
- project
- incident title
- baseline vs current
- suspected dimension
- deep link to incident page

### Email
Simple operator summary with CTA to view incident.

### Webhook
Signed JSON payload for later integrations.

### Cooldown
Respect per-rule cooldown minutes to avoid alert spam.

---

## 13. Exact v1 screen list

### 13.1 `/onboarding`
Purpose:
- create first project
- generate API key
- show install snippet
- show first-trace checklist

Sections:
- create project form
- API key card
- Python install snippet
- Node install snippet
- onboarding checklist

### 13.2 `/overview`
Purpose:
- operator landing page

Cards/sections:
- reliability score
- request volume
- p95 latency
- avg cost/request
- active incidents
- latency trend chart
- cost trend chart
- reliability trend chart
- top failures table
- recent incidents table

### 13.3 `/traces`
Purpose:
- searchable trace explorer

Features:
- filter bar
- trace table
- status badges
- model/prompt columns
- latency/cost columns
- pagination or cursor loading

### 13.4 `/traces/[id]`
Purpose:
- deep trace inspection

Sections:
- request metadata
- input/output viewer
- token + cost panel
- retrieval context panel
- evaluation results panel
- related incident links

### 13.5 `/incidents`
Purpose:
- active and historical incidents

Features:
- status/severity/type filters
- incident table
- severity indicators
- first seen / last seen timestamps

### 13.6 `/incidents/[id]`
Purpose:
- incident investigation page

Sections:
- title + severity + status
- baseline vs current metric summary
- suspected dimension summary
- affected timeline chart
- sample traces
- event history
- acknowledge / resolve actions

### 13.7 `/alerts`
Purpose:
- configure channels and alert rules

Sections:
- Slack channels
- email recipients
- webhooks
- rules table
- cooldown settings

### 13.8 `/settings/projects/[id]`
Purpose:
- project metadata and API key management

Sections:
- project info
- API keys
- environment label
- onboarding state

---

## 14. SDK requirements

### Python SDK
Must support:
- sync helper
- async helper
- explicit trace object or context manager
- manual set for tokens, cost, and retrieval metadata

### Node SDK
Must support:
- server-side helper for common AI routes
- direct trace submission
- optional middleware pattern later

### Installation quality bar
A developer should be able to send a first trace in under 15 minutes.

---

## 15. Security and privacy notes

- hash API keys at rest
- redact or truncate sensitive text fields where configured
- encrypt alert secrets if stored
- support future field-level redaction policy
- avoid storing full raw prompts by default if a project requests redaction mode

---

## 16. Testing requirements

### API tests
- auth guards
- org/project isolation
- ingest validation
- API key auth
- traces filtering
- incident actions

### Worker tests
- eval persistence
- rollup calculations
- regression trigger thresholds
- incident dedupe
- alert cooldown behavior

### UI tests
- onboarding flow
- overview rendering with seeded data
- incidents filters
- trace detail rendering

---

## 17. Definition of done for v1

v1 is done when:
- a new project can be created
- an API key can be issued
- a Python or Node example can send traces
- traces appear in the UI
- evaluations are generated asynchronously
- regressions create incidents
- Slack alerts fire correctly
- an operator can inspect incidents and trace samples
- the overview page gives a truthful snapshot of system health
