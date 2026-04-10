from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel


class EscalationPolicyStepRead(APIModel):
    id: UUID
    policy_id: UUID
    step_number: int
    delay_minutes: int
    action: str
    channel: str
    target: str


class EscalationPolicyRead(APIModel):
    id: UUID
    organization_id: UUID
    name: str
    description: str | None
    trigger_severity: str
    unacknowledged_after_minutes: int
    enabled: bool
    steps: list[EscalationPolicyStepRead]
    active_incident_count: int = 0
    created_at: datetime


class EscalationPolicyListResponse(BaseModel):
    items: list[EscalationPolicyRead]
