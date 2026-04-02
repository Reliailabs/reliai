from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel
from app.schemas.environment import EnvironmentRead, EnvironmentType, EnvironmentTypeInput
from app.schemas.reliability import ReliabilityMetricPointRead


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    environment: EnvironmentTypeInput
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    description: str | None = Field(default=None, max_length=2000)


class ProjectRead(APIModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    environment: EnvironmentType
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    environments: list[EnvironmentRead] = []


class PromptVersionRead(APIModel):
    id: UUID
    project_id: UUID
    version: str
    label: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PromptVersionListResponse(BaseModel):
    items: list[PromptVersionRead]


class ModelVersionRead(APIModel):
    id: UUID
    project_id: UUID
    provider: str | None
    model_name: str
    model_version: str | None
    model_family: str | None
    model_revision: str | None
    route_key: str | None
    label: str | None
    identity_key: str
    created_at: datetime
    updated_at: datetime


class ModelVersionListResponse(BaseModel):
    items: list[ModelVersionRead]


class VersionTraceRead(APIModel):
    id: UUID
    request_id: str
    timestamp: datetime
    model_name: str
    prompt_version: str | None
    latency_ms: int | None
    success: bool
    error_type: str | None
    created_at: datetime


class VersionRegressionRead(APIModel):
    id: UUID
    metric_name: str
    scope_type: str
    scope_id: str
    current_value: float
    baseline_value: float
    delta_percent: float | None
    detected_at: datetime


class VersionIncidentRead(APIModel):
    id: UUID
    incident_type: str
    severity: str
    status: str
    title: str
    started_at: datetime
    updated_at: datetime


class PromptVersionUsageSummaryRead(APIModel):
    trace_count: int
    recent_trace_count: int
    incident_count: int
    regression_count: int


class PromptVersionDetailRead(APIModel):
    prompt_version: PromptVersionRead
    usage_summary: PromptVersionUsageSummaryRead
    recent_traces: list[VersionTraceRead]
    recent_regressions: list[VersionRegressionRead]
    related_incidents: list[VersionIncidentRead]
    recent_reliability_metrics: list[ReliabilityMetricPointRead]
    traces_path: str
    regressions_path: str
    incidents_path: str


class ModelVersionUsageSummaryRead(APIModel):
    trace_count: int
    recent_trace_count: int
    incident_count: int
    regression_count: int


class ModelVersionDetailRead(APIModel):
    model_version: ModelVersionRead
    usage_summary: ModelVersionUsageSummaryRead
    recent_traces: list[VersionTraceRead]
    recent_regressions: list[VersionRegressionRead]
    related_incidents: list[VersionIncidentRead]
    recent_reliability_metrics: list[ReliabilityMetricPointRead]
    traces_path: str
    regressions_path: str
    incidents_path: str


class ProjectListQuery(BaseModel):
    organization_id: UUID | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
