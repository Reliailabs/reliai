from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.common import APIModel


class ExternalProcessorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    event_type: str = Field(min_length=2, max_length=64)
    endpoint_url: HttpUrl
    secret: str = Field(min_length=8, max_length=255)
    enabled: bool = True


class ExternalProcessorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    endpoint_url: HttpUrl | None = None
    secret: str | None = Field(default=None, min_length=8, max_length=255)
    enabled: bool | None = None


class ExternalProcessorRead(APIModel):
    id: UUID
    project_id: UUID
    name: str
    event_type: str
    endpoint_url: str
    enabled: bool
    has_secret: bool
    created_at: datetime
    recent_failure_count: int = 0
    last_failure_at: datetime | None = None


class ExternalProcessorListResponse(BaseModel):
    items: list[ExternalProcessorRead]
