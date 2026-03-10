from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import APIModel


class TimelineEventRead(APIModel):
    timestamp: datetime
    event_type: str
    title: str
    summary: str
    severity: str | None
    metadata: dict[str, Any] | None


class TimelineResponse(BaseModel):
    items: list[TimelineEventRead]
