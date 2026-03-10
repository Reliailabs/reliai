from datetime import datetime
from typing import Any
from uuid import UUID

from app.schemas.common import APIModel


class ReliabilityRecommendationRead(APIModel):
    id: UUID
    project_id: UUID
    type: str
    severity: str
    title: str
    description: str
    evidence_json: dict[str, Any]
    created_at: datetime
