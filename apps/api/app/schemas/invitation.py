from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import AuthSessionResponse
from app.schemas.common import APIModel


class OrganizationInvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    role: str = Field(min_length=3, max_length=32)


class OrganizationInvitationRead(APIModel):
    id: UUID
    organization_id: UUID
    organization_name: str
    invited_email: str
    role: str
    invited_by_user_id: UUID
    invited_by_email: str
    status: str
    signup_path: str
    join_path: str
    expires_at: datetime
    created_at: datetime


class OrganizationInvitationListResponse(BaseModel):
    items: list[OrganizationInvitationRead]


class OrganizationInvitationPublicRead(APIModel):
    id: UUID
    organization_id: UUID
    organization_name: str
    invited_email: str
    role: str
    invited_by_email: str
    status: str
    join_path: str
    expires_at: datetime
    created_at: datetime


class OrganizationInvitationAcceptResponse(AuthSessionResponse):
    join_path: str
