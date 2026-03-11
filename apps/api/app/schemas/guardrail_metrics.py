from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class GuardrailPolicyMetricsRead(APIModel):
    policy_id: UUID
    policy_type: str
    action: str
    trigger_count: int
    last_triggered_at: datetime | None


class GuardrailRuntimeEventSummaryRead(APIModel):
    policy_type: str
    action_taken: str
    provider_model: str | None
    latency_ms: int | None
    created_at: datetime
    trace_id: UUID
    trace_available: bool


class GuardrailTracePolicyCountRead(APIModel):
    policy_type: str
    trigger_count: int


class GuardrailMetricsRead(BaseModel):
    policies: list[GuardrailPolicyMetricsRead]
    recent_events: list[GuardrailRuntimeEventSummaryRead]
    trace_policy_counts: list[GuardrailTracePolicyCountRead] = []
