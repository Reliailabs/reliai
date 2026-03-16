ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS service_name LowCardinality(Nullable(String)) AFTER environment_id;
