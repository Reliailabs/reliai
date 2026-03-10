from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

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
    prompt_version_id: UUID | None
    model_version_id: UUID | None
    environment: str
    deployed_by: str | None
    deployed_at: datetime
    metadata_json: dict[str, Any] | None
    created_at: datetime


class DeploymentDetailRead(DeploymentRead):
    prompt_version: PromptVersionRead | None
    model_version: ModelVersionRead | None
    events: list[DeploymentEventRead]
    rollbacks: list[DeploymentRollbackRead]
    incident_ids: list[UUID]


class DeploymentListResponse(BaseModel):
    items: list[DeploymentRead]


class IncidentDeploymentContextRead(APIModel):
    deployment: DeploymentRead
    prompt_version: PromptVersionRead | None
    model_version: ModelVersionRead | None
    time_since_deployment_minutes: float
