from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class ReliabilityPatternRead(APIModel):
    id: UUID
    pattern_type: str
    model_family: str | None
    prompt_pattern_hash: str | None
    failure_type: str
    failure_probability: float
    sample_count: int
    first_seen_at: datetime
    last_seen_at: datetime


class ReliabilityPatternListResponse(BaseModel):
    items: list[ReliabilityPatternRead]
