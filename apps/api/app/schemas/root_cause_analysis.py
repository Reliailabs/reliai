from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class RootCauseProbabilityRead(APIModel):
    cause_type: str
    label: str
    probability: float
    evidence_json: dict[str, Any] | None


class RootCauseRecommendedFixRead(APIModel):
    fix_type: str
    summary: str
    metadata_json: dict[str, Any] | None


class IncidentAnalysisRead(APIModel):
    incident_id: UUID
    generated_at: datetime
    root_cause_probabilities: list[RootCauseProbabilityRead]
    evidence: dict[str, Any]
    recommended_fix: RootCauseRecommendedFixRead


class IncidentAnalysisResponse(BaseModel):
    incident: IncidentAnalysisRead
