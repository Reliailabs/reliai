ALTER TABLE trace_warehouse
    ADD COLUMN IF NOT EXISTS guardrail_triggered Bool DEFAULT false;

ALTER TABLE trace_warehouse
    ADD PROJECTION IF NOT EXISTS guardrail_trigger_projection
    (
        SELECT guardrail_triggered, count() AS trigger_count
        GROUP BY guardrail_triggered
    );

ALTER TABLE trace_warehouse
    ADD PROJECTION IF NOT EXISTS guardrail_policy_projection
    (
        SELECT JSONExtractString(metadata_json, 'policy_type') AS policy_type, count() AS trigger_count
        GROUP BY policy_type
    );

ALTER TABLE trace_warehouse
    ADD PROJECTION IF NOT EXISTS deployment_projection
    (
        SELECT deployment_id, count() AS trace_count
        GROUP BY deployment_id
    );

ALTER TABLE trace_warehouse
    ADD PROJECTION IF NOT EXISTS incident_projection
    (
        SELECT incident_flag, count() AS trace_count
        GROUP BY incident_flag
    );
