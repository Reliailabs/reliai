from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel

EnvironmentType = Literal["production", "staging", "development"]
EnvironmentTypeInput = Literal["production", "staging", "development", "prod", "stage", "dev"]


class EnvironmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    type: EnvironmentTypeInput


class EnvironmentRead(APIModel):
    id: UUID
    project_id: UUID
    name: str
    type: EnvironmentType
    created_at: datetime


class EnvironmentListResponse(BaseModel):
    items: list[EnvironmentRead]
