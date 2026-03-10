from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, HttpUrl

from app.schemas.common import APIModel


class PlatformExtensionCreate(BaseModel):
    organization_id: UUID
    project_id: UUID
    name: str
    event_type: str
    endpoint_url: HttpUrl
    secret: str
    enabled: bool = True


class PlatformExtensionRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    processor_id: UUID
    name: str
    created_at: datetime


class PlatformExtensionListResponse(APIModel):
    items: list[PlatformExtensionRead]
