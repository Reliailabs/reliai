from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class AlertDeliveryRead(APIModel):
    id: UUID
    incident_id: UUID
    channel_type: str
    channel_target: str
    delivery_status: str
    provider_message_id: str | None
    error_message: str | None
    attempt_count: int
    last_attempted_at: datetime | None
    next_attempt_at: datetime | None
    sent_at: datetime | None
    created_at: datetime


class AlertDeliveryListResponse(BaseModel):
    items: list[AlertDeliveryRead]
