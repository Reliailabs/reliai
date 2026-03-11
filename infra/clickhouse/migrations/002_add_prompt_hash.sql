ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS prompt_hash Nullable(String);

ALTER TABLE trace_warehouse
    ADD PROJECTION IF NOT EXISTS model_reliability_projection
    (
        SELECT model_family, count() AS trace_count, avg(toFloat64(success)) AS success_rate
        GROUP BY model_family
    );
