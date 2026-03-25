from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class OnboardingSimulationCreate(BaseModel):
    project_name: str | None = Field(default=None, max_length=255)
    model_name: str | None = Field(default=None, max_length=255)
    prompt_type: str | None = Field(default=None, max_length=120)
    simulation_type: str | None = Field(default="refusal_spike", max_length=120)


class OnboardingSimulationCreateResponse(BaseModel):
    simulation_id: UUID


class OnboardingSimulationStatusRead(BaseModel):
    simulation_id: UUID
    status: Literal["pending", "running", "complete", "failed"]
    progress: int
    stage: str
    incident_id: UUID | None = None
    error: str | None = None
    created_at: datetime
