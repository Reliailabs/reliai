from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class UsageQuotaUpsert(BaseModel):
    max_traces_per_day: int | None = Field(default=None, ge=1)
    max_processors: int | None = Field(default=None, ge=1)
    max_api_requests: int | None = Field(default=None, ge=1)


class UsageQuotaRead(APIModel):
    id: UUID
    organization_id: UUID
    max_traces_per_day: int | None
    max_processors: int | None
    max_api_requests: int | None
