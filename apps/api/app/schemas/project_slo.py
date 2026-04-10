from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class ProjectSLORead(APIModel):
    id: UUID
    project_id: UUID
    organization_id: UUID
    name: str
    description: str | None
    metric_type: str
    target_value: float
    window_days: int
    enabled: bool
    current_value: float | None = None
    status: str | None = None
    trend: str | None = None
    created_at: datetime
    updated_at: datetime


class ProjectSLOListResponse(BaseModel):
    items: list[ProjectSLORead]
