from datetime import datetime
from uuid import UUID

from app.schemas.common import APIModel


class ReliabilityActionLogRead(APIModel):
    id: UUID
    project_id: UUID
    rule_id: UUID | None
    action_type: str
    target: str
    status: str
    detail_json: dict | None
    created_at: datetime


class ReliabilityActionLogListResponse(APIModel):
    items: list[ReliabilityActionLogRead]
