from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class RuntimeGuardrailPolicyRead(APIModel):
    id: UUID
    policy_type: str
    action: str
    config: dict[str, Any]


class RuntimeGuardrailPolicyListResponse(BaseModel):
    policies: list[RuntimeGuardrailPolicyRead]


class RuntimeGuardrailEventCreate(BaseModel):
    trace_id: UUID
    policy_id: UUID
    action_taken: str = Field(pattern=r"^(block|retry|fallback_model|log_only)$")
    provider_model: str | None = Field(default=None, max_length=255)
    latency_ms: int | None = Field(default=None, ge=0)
    metadata_json: dict[str, Any] | None = None


class RuntimeGuardrailEventRead(APIModel):
    id: UUID
    trace_id: UUID
    policy_id: UUID
    action_taken: str
    provider_model: str | None
    latency_ms: int | None
    metadata_json: dict[str, Any] | None
    created_at: datetime
