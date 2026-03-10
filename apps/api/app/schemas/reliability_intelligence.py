from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import APIModel


class ModelReliabilityPatternRead(APIModel):
    provider: str
    model_name: str
    failure_modes: dict[str, Any]
    structured_output_failure_rate: float
    latency_percentiles: dict[str, Any]
    cost_distribution: dict[str, Any]
    updated_at: datetime


class ModelReliabilityPatternListResponse(BaseModel):
    items: list[ModelReliabilityPatternRead]


class PromptFailurePatternRead(APIModel):
    prompt_pattern_hash: str
    failure_rate: float
    token_range: dict[str, Any]
    model_distribution: dict[str, Any]
    updated_at: datetime


class PromptFailurePatternListResponse(BaseModel):
    items: list[PromptFailurePatternRead]


class GuardrailEffectivenessRead(APIModel):
    policy_type: str
    action: str
    failure_reduction_rate: float
    updated_at: datetime


class GuardrailEffectivenessListResponse(BaseModel):
    items: list[GuardrailEffectivenessRead]
