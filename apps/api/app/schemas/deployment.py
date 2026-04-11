from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIModel
from app.schemas.project import ModelVersionRead, PromptVersionRead


class DeploymentCreate(BaseModel):
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    environment: str = Field(min_length=2, max_length=32)
    deployed_by: str | None = Field(default=None, max_length=255)
    deployed_at: datetime
    metadata_json: dict[str, Any] | None = None


class DeploymentEventRead(APIModel):
    id: UUID
    deployment_id: UUID
    event_type: str
    metadata_json: dict[str, Any] | None
    created_at: datetime


class DeploymentRollbackRead(APIModel):
    id: UUID
    deployment_id: UUID
    rollback_reason: str
    rolled_back_at: datetime
    created_at: datetime


class DeploymentRead(APIModel):
    id: UUID
    project_id: UUID
    environment_id: UUID
    prompt_version_id: UUID | None
    model_version_id: UUID | None
    environment: str
    deployed_by: str | None
    deployed_at: datetime
    metadata_json: dict[str, Any] | None
    risk_analysis_json: dict[str, Any] | None = None
    created_at: datetime


class DeploymentRiskSignalRead(APIModel):
    signal_name: str
    value: float
    weight: float
    weighted_value: float
    summary: str


class DeploymentRiskRecommendationRead(APIModel):
    action: str
    summary: str


class DeploymentRiskRead(APIModel):
    deployment_id: UUID
    risk_score: float
    risk_level: str
    analysis_json: dict[str, Any]
    recommendations: list[DeploymentRiskRecommendationRead]
    created_at: datetime


class DeploymentIntelligencePatternRead(APIModel):
    pattern: str
    risk: str
    trace_count: int


class DeploymentIntelligenceRead(APIModel):
    deployment_id: UUID
    risk_score: float | None
    risk_explanations: list[str]
    graph_risk_patterns: list[DeploymentIntelligencePatternRead]
    recommended_guardrails: list[str]


class DeploymentRegressionRiskRead(APIModel):
    is_regression: bool
    reasons: list[str]


class DeploymentGateRead(APIModel):
    decision: str
    risk_score: int
    explanations: list[str]
    recommended_guardrails: list[str]
    regression_risk: DeploymentRegressionRiskRead | None = None


class DeploymentSimulationCreate(BaseModel):
    environment: str | None = Field(default=None, min_length=2, max_length=32)
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    sample_size: int = Field(default=50, ge=1, le=500)

    @model_validator(mode="after")
    def validate_scope(self) -> "DeploymentSimulationCreate":
        if self.prompt_version_id is None and self.model_version_id is None:
            raise ValueError("prompt_version_id or model_version_id is required")
        return self


class DeploymentSimulationRead(APIModel):
    id: UUID
    project_id: UUID
    environment_id: UUID
    prompt_version_id: UUID | None
    model_version_id: UUID | None
    trace_sample_size: int
    predicted_failure_rate: float | None
    predicted_latency_ms: float | None
    risk_level: str | None
    analysis_json: dict[str, Any]
    created_at: datetime


class DeploymentDetailRead(DeploymentRead):
    prompt_version: PromptVersionRead | None
    model_version: ModelVersionRead | None
    events: list[DeploymentEventRead]
    rollbacks: list[DeploymentRollbackRead]
    incident_ids: list[UUID]
    latest_risk_score: DeploymentRiskRead | None = None
    intelligence: DeploymentIntelligenceRead | None = None
    gate: DeploymentGateRead | None = None


class DeploymentListResponse(BaseModel):
    items: list[DeploymentRead]


class IncidentDeploymentContextRead(APIModel):
    deployment: DeploymentRead
    prompt_version: PromptVersionRead | None
    model_version: ModelVersionRead | None
    time_since_deployment_minutes: float
