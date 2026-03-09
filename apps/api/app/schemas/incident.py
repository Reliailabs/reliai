from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel
from app.schemas.regression import RegressionSnapshotRead


class IncidentListQuery(BaseModel):
    project_id: UUID | None = None
    status: str | None = Field(default=None, pattern=r"^(open|resolved)$")
    limit: int = Field(default=25, ge=1, le=100)


class IncidentTraceSampleRead(APIModel):
    id: UUID
    request_id: str
    timestamp: datetime
    success: bool
    error_type: str | None
    latency_ms: int | None
    total_cost_usd: Decimal | None


class IncidentListItemRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    project_name: str
    incident_type: str
    severity: str
    title: str
    status: str
    fingerprint: str
    summary_json: dict[str, Any]
    started_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class IncidentListResponse(BaseModel):
    items: list[IncidentListItemRead]


class IncidentDetailRead(IncidentListItemRead):
    regressions: list[RegressionSnapshotRead]
    traces: list[IncidentTraceSampleRead]
