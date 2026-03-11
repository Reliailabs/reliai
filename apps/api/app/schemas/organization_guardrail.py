from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIModel


class OrganizationGuardrailPolicyRead(APIModel):
    id: UUID
    organization_id: UUID
    policy_type: str
    config_json: dict[str, Any]
    enforcement_mode: str
    enabled: bool
    created_at: datetime


class OrganizationGuardrailPolicyListResponse(BaseModel):
    items: list[OrganizationGuardrailPolicyRead]


class PolicyViolationEventCreate(BaseModel):
    trace_id: str
    policy_type: str
    enforcement_mode: str = Field(pattern=r"^(observe|warn|enforce|block)$")
    action_taken: str = Field(pattern=r"^(observe|warn|enforce|block|retry|fallback_model|block_response|raise)$")
    message: str | None = Field(default=None, max_length=255)
    provider_model: str | None = Field(default=None, max_length=255)
    latency_ms: int | None = Field(default=None, ge=0)
    metadata_json: dict[str, Any] | None = None

    @model_validator(mode="after")
    def normalize_metadata(self) -> "PolicyViolationEventCreate":
        metadata = dict(self.metadata_json or {})
        if self.message and "message" not in metadata:
            metadata["message"] = self.message
        self.metadata_json = metadata or None
        return self
