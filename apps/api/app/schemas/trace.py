import json
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIModel
from app.core.settings import get_settings


class RetrievalSpanIngest(BaseModel):
    retrieval_latency_ms: int | None = Field(default=None, ge=0)
    source_count: int | None = Field(default=None, ge=0)
    top_k: int | None = Field(default=None, ge=0)
    query_text: str | None = None
    retrieved_chunks_json: list[dict[str, Any]] | None = None

    @model_validator(mode="after")
    def validate_chunk_count(self) -> "RetrievalSpanIngest":
        if self.retrieved_chunks_json is not None and len(self.retrieved_chunks_json) > 100:
            raise ValueError("retrieved_chunks_json supports at most 100 entries")
        return self


class RetrievalSpanRead(APIModel):
    retrieval_latency_ms: int | None
    source_count: int | None
    top_k: int | None
    query_text: str | None
    retrieved_chunks_json: list[dict[str, Any]] | None


class EvaluationRead(APIModel):
    id: UUID
    eval_type: str
    score: Decimal | None
    label: str | None
    explanation: str | None
    evaluator_provider: str | None
    evaluator_model: str | None
    evaluator_version: str | None
    raw_result_json: dict[str, Any] | None
    created_at: datetime


class TraceListQuery(BaseModel):
    project_id: UUID | None = None
    model_name: str | None = Field(default=None, max_length=255)
    prompt_version: str | None = Field(default=None, max_length=120)
    success: bool | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = Field(default=25, ge=1, le=100)
    cursor: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "TraceListQuery":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        return self


class TraceIngestRequest(BaseModel):
    timestamp: datetime
    request_id: str = Field(min_length=2, max_length=255)
    user_id: str | None = Field(default=None, max_length=255)
    session_id: str | None = Field(default=None, max_length=255)
    model_name: str = Field(min_length=1, max_length=255)
    model_provider: str | None = Field(default=None, max_length=120)
    prompt_version: str | None = Field(default=None, max_length=120)
    input_text: str | None = None
    output_text: str | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    total_cost_usd: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=6)
    success: bool
    error_type: str | None = Field(default=None, max_length=120)
    metadata_json: dict[str, Any] | None = None
    retrieval: RetrievalSpanIngest | None = None

    @model_validator(mode="after")
    def validate_metadata(self) -> "TraceIngestRequest":
        settings = get_settings()
        if self.metadata_json is not None and len(self.metadata_json) > 50:
            raise ValueError("metadata_json supports at most 50 top-level keys")
        if self.metadata_json is not None:
            metadata_size = len(
                json.dumps(self.metadata_json, separators=(",", ":"), sort_keys=True).encode("utf-8")
            )
            if metadata_size > settings.trace_metadata_max_bytes:
                raise ValueError("metadata_json exceeds maximum size")
        if self.success and self.error_type is not None:
            raise ValueError("error_type must be null when success is true")
        if self.input_text is not None and len(self.input_text) > settings.trace_input_text_max_chars:
            raise ValueError("input_text exceeds maximum size")
        if self.output_text is not None and len(self.output_text) > settings.trace_output_text_max_chars:
            raise ValueError("output_text exceeds maximum size")
        return self


class TraceAcceptedResponse(BaseModel):
    status: str = "accepted"
    trace_id: UUID


class TraceListItemRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    environment: str
    timestamp: datetime
    request_id: str
    model_name: str
    model_provider: str | None
    prompt_version: str | None
    input_preview: str | None
    output_preview: str | None
    latency_ms: int | None
    success: bool
    error_type: str | None
    created_at: datetime


class TraceListResponse(BaseModel):
    items: list[TraceListItemRead]
    next_cursor: str | None


class TraceDetailRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    environment: str
    timestamp: datetime
    request_id: str
    user_id: str | None
    session_id: str | None
    model_name: str
    model_provider: str | None
    prompt_version: str | None
    input_text: str | None
    output_text: str | None
    input_preview: str | None
    output_preview: str | None
    latency_ms: int | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_cost_usd: Decimal | None
    success: bool
    error_type: str | None
    metadata_json: dict[str, Any] | None
    created_at: datetime
    retrieval_span: RetrievalSpanRead | None
    evaluations: list[EvaluationRead]


class TraceCompareEvaluationRead(APIModel):
    label: str | None
    score: Decimal | None
    reason: str | None


class TraceCompareRetrievalRead(APIModel):
    retrieval_latency_ms: int | None
    source_count: int | None
    top_k: int | None


class TraceCompareItemRead(APIModel):
    id: UUID
    request_id: str
    timestamp: datetime
    model_name: str
    prompt_version: str | None
    success: bool
    error_type: str | None
    latency_ms: int | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_cost_usd: Decimal | None
    structured_output: TraceCompareEvaluationRead | None
    retrieval: TraceCompareRetrievalRead | None
    metadata_excerpt_json: dict[str, Any] | None


class TraceComparePairRead(APIModel):
    pair_index: int
    current_trace: TraceCompareItemRead | None
    baseline_trace: TraceCompareItemRead | None


class TraceComparisonRead(APIModel):
    incident_id: UUID
    project_id: UUID
    metric_name: str | None
    scope_type: str | None
    scope_id: str | None
    current_window_start: datetime | None
    current_window_end: datetime | None
    baseline_window_start: datetime | None
    baseline_window_end: datetime | None
    current_traces: list[TraceCompareItemRead]
    baseline_traces: list[TraceCompareItemRead]
    pairs: list[TraceComparePairRead]
