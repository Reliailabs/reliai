from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AuthSignInRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class OperatorMembershipRead(BaseModel):
    organization_id: UUID
    role: str


class OperatorRead(BaseModel):
    id: UUID
    email: str
    is_system_admin: bool = False


class AuthSessionResponse(BaseModel):
    session_token: str | None = None
    operator: OperatorRead
    memberships: list[OperatorMembershipRead]
    expires_at: datetime
