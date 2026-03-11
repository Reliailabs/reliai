from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class ReliaiRetrievalSpan:
    retrieval_latency_ms: int | None = None
    source_count: int | None = None
    top_k: int | None = None
    query_text: str | None = None
    retrieved_chunks: list[dict[str, Any]] | None = None


@dataclass(slots=True)
class ReliaiTraceEvent:
    model: str
    provider: str | None = None
    input_text: str | None = None
    output_text: str | None = None
    latency_ms: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_cost_usd: float | None = None
    success: bool = True
    request_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    span_name: str | None = None
    start_time: datetime | None = None
    duration_ms: int | None = None
    timestamp: datetime | None = None
    environment: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    prompt_version: str | None = None
    error_type: str | None = None
    metadata: dict[str, Any] | None = None
    retrieval: ReliaiRetrievalSpan | None = None
