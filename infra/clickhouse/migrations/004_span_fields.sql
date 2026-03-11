ALTER TABLE trace_warehouse
    RENAME COLUMN IF EXISTS trace_id TO storage_trace_id;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS trace_id Nullable(String) AFTER environment_id;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS span_id Nullable(String) AFTER trace_id;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS parent_span_id Nullable(String) AFTER span_id;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS span_name LowCardinality(Nullable(String)) AFTER parent_span_id;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS guardrail_policy LowCardinality(Nullable(String)) AFTER structured_output_valid;

ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS guardrail_action LowCardinality(Nullable(String)) AFTER guardrail_policy;

ALTER TABLE trace_warehouse
    UPDATE trace_id = toString(storage_trace_id)
    WHERE trace_id IS NULL;

ALTER TABLE trace_warehouse
    UPDATE span_id = toString(storage_trace_id)
    WHERE span_id IS NULL;

ALTER TABLE trace_warehouse
    MODIFY ORDER BY (project_id, trace_id, timestamp, span_id);
