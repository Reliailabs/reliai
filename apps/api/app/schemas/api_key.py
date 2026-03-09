from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class APIKeyCreate(BaseModel):
    label: str = Field(min_length=2, max_length=120)


class APIKeyRead(APIModel):
    id: UUID
    project_id: UUID
    key_prefix: str
    label: str
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class APIKeyCreateResponse(BaseModel):
    api_key: str
    api_key_record: APIKeyRead
