from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel

PlanType = Literal["free", "pilot", "growth", "enterprise"]
RoleType = Literal["owner", "admin", "member"]


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    plan: PlanType = "free"
    owner_auth_user_id: str = Field(min_length=2, max_length=255)
    owner_role: RoleType = "owner"


class OrganizationRead(APIModel):
    id: UUID
    name: str
    slug: str
    plan: PlanType
    created_at: datetime
    updated_at: datetime
