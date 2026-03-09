from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel

EnvironmentType = Literal["prod", "staging", "dev"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    environment: EnvironmentType
    description: str | None = Field(default=None, max_length=2000)


class ProjectRead(APIModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    environment: EnvironmentType
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProjectListQuery(BaseModel):
    organization_id: UUID | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
