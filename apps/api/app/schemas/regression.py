from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class RegressionListQuery(BaseModel):
    limit: int = Field(default=25, ge=1, le=100)


class RegressionSnapshotRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    metric_name: str
    current_value: Decimal
    baseline_value: Decimal
    delta_absolute: Decimal
    delta_percent: Decimal | None
    scope_type: str
    scope_id: str
    window_minutes: int
    detected_at: datetime
    metadata_json: dict[str, Any] | None


class RegressionListResponse(BaseModel):
    items: list[RegressionSnapshotRead]
