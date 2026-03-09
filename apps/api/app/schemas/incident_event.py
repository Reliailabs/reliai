from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class IncidentEventRead(APIModel):
    id: UUID
    incident_id: UUID
    event_type: str
    actor_operator_user_id: UUID | None
    actor_operator_user_email: str | None
    metadata_json: dict[str, Any] | None
    created_at: datetime


class IncidentEventListResponse(BaseModel):
    items: list[IncidentEventRead]
