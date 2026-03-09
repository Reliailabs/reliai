from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.common import APIModel


class OrganizationAlertTargetUpsertRequest(BaseModel):
    channel_target: str = Field(min_length=2, max_length=255)
    slack_webhook_url: HttpUrl | None = None
    is_active: bool = True


class OrganizationAlertTargetRead(APIModel):
    id: UUID
    organization_id: UUID
    channel_type: str
    channel_target: str
    is_active: bool
    has_secret: bool
    webhook_masked: str | None
    created_at: datetime
    updated_at: datetime


class OrganizationAlertTargetTestResponse(BaseModel):
    success: bool
    detail: str
    tested_at: datetime
