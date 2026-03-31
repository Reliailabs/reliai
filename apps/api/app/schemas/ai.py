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


class AiRootCauseExplanationRequest(BaseModel):
    regenerate: bool = Field(default=False)


class AiRootCauseExplanationModelInfo(BaseModel):
    provider: str
    model: str


class AiRootCauseExplanationResponse(BaseModel):
    explanation: str | None = None
    what_to_check_next: str | None = None
    evidence_used: list[str] = Field(default_factory=list)
    generated_at: datetime
    model: AiRootCauseExplanationModelInfo | None = None
    status: Literal["ok", "insufficient_evidence", "error"] = "ok"
    is_stale: bool = False


class AiTicketDraftRequest(BaseModel):
    destination: Literal["jira", "github"] = Field(default="jira")
    regenerate: bool = Field(default=False)


class AiTicketDraftModelInfo(BaseModel):
    provider: str
    model: str


class AiTicketDraftResponse(BaseModel):
    title: str | None = None
    body: str | None = None
    evidence_used: list[str] = Field(default_factory=list)
    generated_at: datetime
    model: AiTicketDraftModelInfo | None = None
    status: Literal["ok", "insufficient_evidence", "error"] = "ok"
