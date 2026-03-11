from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.common import APIModel


class PlatformExtensionCreate(BaseModel):
    organization_id: UUID
    project_id: UUID
    name: str = Field(min_length=2, max_length=255)
    event_type: str = Field(min_length=2, max_length=64)
    endpoint_url: HttpUrl
    secret: str = Field(min_length=8, max_length=255)
    processor_type: str = Field(default="extension", min_length=2, max_length=64)
    version: str = Field(default="1.0.0", min_length=1, max_length=64)
    config_json: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class PlatformExtensionRead(APIModel):
    id: UUID | str
    organization_id: UUID | None
    project_id: UUID | None
    processor_id: UUID | None
    name: str
    processor_type: str
    version: str
    event_type: str
    endpoint_url: str
    enabled: bool
    config_json: dict[str, Any]
    health: str
    event_throughput_per_hour: int
    recent_failure_count: int
    last_invoked_at: datetime | None = None
    last_failure_at: datetime | None = None
    created_at: datetime | None = None


class PlatformExtensionListResponse(APIModel):
    items: list[PlatformExtensionRead]
