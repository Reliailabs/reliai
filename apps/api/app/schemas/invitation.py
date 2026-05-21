from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class OrganizationInvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    role: str = Field(min_length=3, max_length=32)


class OrganizationInvitationRead(APIModel):
    id: UUID
    organization_id: UUID
    invited_email: str
    role: str
    invited_by_user_id: UUID
    invited_by_email: str
    status: str
    signup_path: str
    expires_at: datetime
    created_at: datetime


class OrganizationInvitationListResponse(BaseModel):
    items: list[OrganizationInvitationRead]
