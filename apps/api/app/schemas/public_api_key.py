from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class PublicAPIKeyCreate(BaseModel):
    organization_id: UUID
    name: str = Field(min_length=2, max_length=120)


class PublicAPIKeyRead(APIModel):
    id: UUID
    organization_id: UUID
    key_prefix: str
    name: str
    revoked: bool
    last_used_at: datetime | None
    created_at: datetime


class PublicAPIKeyCreateResponse(BaseModel):
    api_key: str
    api_key_record: PublicAPIKeyRead


class PublicAPIKeyListResponse(APIModel):
    items: list[PublicAPIKeyRead]
