from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.timeline import TimelineEventRead


class CustomerReliabilityProjectRead(APIModel):
    project_id: UUID
    project_name: str
    trace_volume_24h: int
    traces_per_day: int
    guardrail_rate: float
    incident_rate: float
    processor_failures: int
    processor_failure_rate: float
    pipeline_lag: int
    risk_level: str


class CustomerReliabilityListRead(APIModel):
    projects: list[CustomerReliabilityProjectRead]


class CustomerReliabilityDailyPointRead(APIModel):
    date: str
    trace_volume: int


class CustomerReliabilityGuardrailEventRead(APIModel):
    created_at: datetime
    policy_type: str
    action_taken: str
    provider_model: str | None
    latency_ms: int | None


class CustomerReliabilityIncidentRead(APIModel):
    incident_id: UUID
    title: str
    severity: str
    status: str
    started_at: datetime


class CustomerReliabilityDeploymentRead(APIModel):
    deployment_id: UUID
    environment: str
    deployed_at: datetime
    deployed_by: str | None


class CustomerReliabilityProcessorFailureRead(APIModel):
    failure_id: UUID
    processor_name: str
    event_type: str
    attempts: int
    last_error: str
    created_at: datetime


class CustomerReliabilityDetailRead(APIModel):
    project: CustomerReliabilityProjectRead
    trace_volume_chart: list[CustomerReliabilityDailyPointRead]
    guardrail_triggers: list[CustomerReliabilityGuardrailEventRead]
    incident_history: list[CustomerReliabilityIncidentRead]
    deployment_changes: list[CustomerReliabilityDeploymentRead]
    processor_failures: list[CustomerReliabilityProcessorFailureRead]
    recent_timeline: list[TimelineEventRead] = Field(default_factory=list)
