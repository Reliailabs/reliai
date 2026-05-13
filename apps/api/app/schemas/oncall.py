from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class OncallAssignmentUpsert(BaseModel):
    role: str = Field(min_length=3, max_length=32)
    user_id: UUID
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class OncallAssignmentRead(APIModel):
    id: UUID
    role: str
    user_id: UUID
    name: str | None = None
    email: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class OncallEscalationStepUpsert(BaseModel):
    step_order: int = Field(ge=1, le=20)
    target_role: str = Field(min_length=3, max_length=32)
    wait_minutes: int = Field(ge=0, le=1440)
    channel: str = Field(min_length=3, max_length=16)


class OncallEscalationStepRead(APIModel):
    id: UUID
    step_order: int
    target_role: str
    wait_minutes: int
    channel: str


class ProjectOncallRead(APIModel):
    project_id: UUID
    rotation_id: UUID
    rotation_name: str
    timezone: str
    is_active: bool
    assignments: list[OncallAssignmentRead]
    escalation_policy: list[OncallEscalationStepRead]


class OncallAssignmentsUpdateRequest(BaseModel):
    items: list[OncallAssignmentUpsert]


class OncallEscalationPolicyUpdateRequest(BaseModel):
    items: list[OncallEscalationStepUpsert]
