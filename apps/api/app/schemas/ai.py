from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AiIncidentSummaryRequest(BaseModel):
    regenerate: bool = Field(default=False)


class AiIncidentSummaryModelInfo(BaseModel):
    provider: str
    model: str


class AiIncidentSummaryResponse(BaseModel):
    summary: str | None = None
    recommended_next_step: str | None = None
    evidence_used: list[str] = Field(default_factory=list)
    generated_at: datetime
    model: AiIncidentSummaryModelInfo | None = None
    status: Literal["ok", "insufficient_evidence", "error"] = "ok"
