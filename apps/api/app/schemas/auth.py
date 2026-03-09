from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class AuthSignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class OperatorMembershipRead(BaseModel):
    organization_id: UUID
    role: str


class OperatorRead(BaseModel):
    id: UUID
    email: EmailStr


class AuthSessionResponse(BaseModel):
    session_token: str | None = None
    operator: OperatorRead
    memberships: list[OperatorMembershipRead]
    expires_at: datetime
