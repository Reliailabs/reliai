from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class OrganizationMemberCreate(BaseModel):
    user_id: UUID
    role: str = Field(min_length=3, max_length=32)


class OrganizationMemberRead(APIModel):
    user_id: UUID
    organization_id: UUID
    role: str
    email: str | None = None
    created_at: datetime


class OrganizationMemberListResponse(BaseModel):
    items: list[OrganizationMemberRead]


class ProjectMemberCreate(BaseModel):
    user_id: UUID
    role: str = Field(min_length=3, max_length=32)


class ProjectMemberRead(APIModel):
    user_id: UUID
    project_id: UUID
    role: str
    email: str | None = None
    created_at: datetime


class ProjectMemberListResponse(BaseModel):
    items: list[ProjectMemberRead]
