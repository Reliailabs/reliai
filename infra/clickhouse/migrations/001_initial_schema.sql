CREATE TABLE IF NOT EXISTS trace_warehouse
(
    event_version UInt16,
    timestamp DateTime64(3, 'UTC'),
    organization_id UUID,
    project_id UUID,
    environment_id Nullable(UUID),
    trace_id UUID,
    deployment_id Nullable(UUID),
    model_provider Nullable(String),
    model_family Nullable(String),
    model_revision Nullable(String),
    prompt_version_id Nullable(String),
    prompt_hash Nullable(String),
    model_version_id Nullable(UUID),
    success Bool,
    latency_ms Nullable(Int32),
    error_type Nullable(String),
    input_tokens Nullable(Int32),
    output_tokens Nullable(Int32),
    cost_usd Nullable(Float64),
    structured_output_valid Nullable(Bool),
    guardrail_triggered Bool DEFAULT false,
    retrieval_latency_ms Nullable(Int32),
    retrieval_chunks Nullable(Int32),
    incident_flag Bool DEFAULT false,
    metadata_json String,
    retention_days UInt16 DEFAULT 30
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
PRIMARY KEY (project_id, timestamp)
ORDER BY (project_id, timestamp, trace_id)
TTL timestamp + toIntervalDay(retention_days);

CREATE TABLE IF NOT EXISTS trace_metrics_hourly
(
    project_id UUID,
    environment_id Nullable(UUID),
    model_family Nullable(String),
    time_bucket DateTime('UTC'),
    trace_count UInt64,
    success_rate Float64,
    latency_avg Float64,
    token_count UInt64,
    cost_usd Float64
)
ENGINE = SummingMergeTree
PARTITION BY toDate(time_bucket)
ORDER BY (project_id, environment_id, model_family, time_bucket);

CREATE TABLE IF NOT EXISTS trace_metrics_daily
(
    project_id UUID,
    environment_id Nullable(UUID),
    model_family Nullable(String),
    time_bucket Date,
    trace_count UInt64,
    success_rate Float64,
    latency_avg Float64,
    token_count UInt64,
    cost_usd Float64
)
ENGINE = SummingMergeTree
PARTITION BY time_bucket
ORDER BY (project_id, environment_id, model_family, time_bucket);

CREATE MATERIALIZED VIEW IF NOT EXISTS trace_metrics_hourly_mv
TO trace_metrics_hourly
AS
SELECT
    project_id,
    environment_id,
    model_family,
    toStartOfHour(timestamp) AS time_bucket,
    count() AS trace_count,
    avg(toFloat64(success)) AS success_rate,
    avg(toFloat64(latency_ms)) AS latency_avg,
    sum(toUInt64(ifNull(input_tokens, 0) + ifNull(output_tokens, 0))) AS token_count,
    sum(toFloat64(ifNull(cost_usd, 0))) AS cost_usd
FROM trace_warehouse
GROUP BY project_id, environment_id, model_family, time_bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS trace_metrics_daily_mv
TO trace_metrics_daily
AS
SELECT
    project_id,
    environment_id,
    model_family,
    toDate(timestamp) AS time_bucket,
    count() AS trace_count,
    avg(toFloat64(success)) AS success_rate,
    avg(toFloat64(latency_ms)) AS latency_avg,
    sum(toUInt64(ifNull(input_tokens, 0) + ifNull(output_tokens, 0))) AS token_count,
    sum(toFloat64(ifNull(cost_usd, 0))) AS cost_usd
FROM trace_warehouse
GROUP BY project_id, environment_id, model_family, time_bucket;
