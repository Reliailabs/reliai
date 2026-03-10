from app.schemas.common import APIModel


class SupportDebugPipelineEventRead(APIModel):
    consumer_name: str
    health: str
    lag: int
    error_count_recent: int
    last_processed_at: str | None


class SupportDebugProcessorFailureRead(APIModel):
    processor_name: str
    event_type: str
    last_error: str
    created_at: str


class SupportDebugGuardrailRead(APIModel):
    policy_type: str
    action_taken: str
    created_at: str
    environment: str | None


class SupportDebugTraceSampleRead(APIModel):
    trace_id: str
    environment: str
    created_at: str
    success: bool
    latency_ms: int | None


class SupportDebugRead(APIModel):
    project_id: str
    ingestion_policy: dict
    pipeline: list[SupportDebugPipelineEventRead]
    processor_failures: list[SupportDebugProcessorFailureRead]
    trace_samples: list[SupportDebugTraceSampleRead]
    guardrail_triggers: list[SupportDebugGuardrailRead]
