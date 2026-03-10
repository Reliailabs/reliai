from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIModel


class GuardrailPolicyCreate(BaseModel):
    policy_type: str = Field(pattern=r"^(structured_output|hallucination|cost_budget|latency_retry)$")
    config_json: dict[str, Any]
    is_active: bool = True

    @model_validator(mode="after")
    def validate_config(self) -> "GuardrailPolicyCreate":
        action = self.config_json.get("action")
        if action not in {"block", "retry", "fallback_model", "log_only"}:
            raise ValueError("config_json.action must be one of block, retry, fallback_model, log_only")
        if self.policy_type == "cost_budget" and self.config_json.get("max_cost_usd") is None:
            raise ValueError("cost_budget requires config_json.max_cost_usd")
        if self.policy_type == "latency_retry" and self.config_json.get("max_latency_ms") is None:
            raise ValueError("latency_retry requires config_json.max_latency_ms")
        if action == "fallback_model" and self.config_json.get("fallback_model") is None:
            raise ValueError("fallback_model action requires config_json.fallback_model")
        return self


class GuardrailPolicyRead(APIModel):
    id: UUID
    project_id: UUID
    policy_type: str
    config_json: dict[str, Any]
    is_active: bool
    created_at: datetime


class GuardrailEventRead(APIModel):
    id: UUID
    trace_id: UUID
    policy_id: UUID
    action_taken: str
    metadata_json: dict[str, Any] | None
    created_at: datetime


class GuardrailPolicyListResponse(BaseModel):
    items: list[GuardrailPolicyRead]
