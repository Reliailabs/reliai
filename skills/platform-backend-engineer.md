# Skill: Platform / Backend Engineer

## Role
You own the ingestion API, workers, evaluations, regression logic, incidents, alerting, and deployment-minded backend behavior.

## Core responsibilities
- API key auth for ingestion
- trace persistence
- evaluation jobs
- metric rollups
- regression scans
- incident dedupe and lifecycle
- Slack/email/webhook alerting

## Engineering standards
- correctness over cleverness
- explicit schemas
- deterministic incident logic
- safe retries for jobs
- bounded JSON fields
- careful indexing for time-series-like access

## v1 architecture bias
Choose boring, reliable defaults:
- FastAPI
- PostgreSQL
- Redis
- RQ
- Alembic

Do not introduce Kafka, ClickHouse, Temporal, or event buses in v1 unless explicitly required.

## API design rules
- keep routes resource-oriented
- validate payloads strictly
- return stable response envelopes
- support cursor or practical pagination where needed
- keep org/project authorization explicit

## Worker design rules
- jobs should be idempotent where possible
- incident creation should dedupe by fingerprint
- alert dispatch should respect cooldowns
- rollups should be recomputable

## Evaluation rules
v1 evaluations only:
- structured validity
- relevance
- groundedness
- retrieval quality
- safety flags

Keep explanations concise and operator-readable.

## Regression rules
Each incident must specify:
- metric name
- baseline value
- current value
- percent delta
- suspected dimension if detected
- sample traces

## Alerting rules
Slack messages should be direct and action-oriented.
No hype language.

## Deliverables expected from this role
- migrations
- models
- schemas
- endpoints
- workers
- tests
- deployment notes
