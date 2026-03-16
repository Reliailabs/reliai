from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.trace import Trace

TRACE_EVENT_VERSION_V1 = 1


def _isoformat_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _float_or_none(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


class TraceEventModelInfoV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    provider: str | None = None
    family: str | None = None
    revision: str | None = None


class TraceEventTokensV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    input: int | None = Field(default=None, ge=0)
    output: int | None = Field(default=None, ge=0)


class TraceEventEvaluationV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    structured_output_valid: bool | None = None
    quality_pass: bool | None = None


class TraceEventRetrievalV1(BaseModel):
    model_config = ConfigDict(extra="allow")

    latency_ms: int | None = Field(default=None, ge=0)
    chunks: int | None = Field(default=None, ge=0)


class TraceEventV1(BaseModel):
    # Backward compatibility rule: additive fields are allowed, removals are not.
    model_config = ConfigDict(extra="allow")

    event_version: Literal[1] = TRACE_EVENT_VERSION_V1
    event_type: str
    trace_id: str
    timestamp: datetime
    organization_id: str
    project_id: str
    environment_id: str | None = None
    model: TraceEventModelInfoV1
    prompt_version_id: str | None = None
    service_name: str | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    success: bool
    tokens: TraceEventTokensV1
    cost_usd: float | None = None
    evaluation: TraceEventEvaluationV1
    retrieval: TraceEventRetrievalV1
    metadata: dict[str, Any] = Field(default_factory=dict)


TRACE_EVENT_V1 = TraceEventV1
SUPPORTED_TRACE_EVENT_VERSIONS: dict[int, type[TraceEventV1]] = {
    TRACE_EVENT_VERSION_V1: TraceEventV1,
}


def build_trace_event_payload(
    trace: Trace,
    *,
    event_type: str,
    structured_output_valid: bool | None = None,
    quality_pass: bool | None = None,
    metadata_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    timestamp = trace.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    model_version = getattr(trace, "model_version_record", None)
    metadata = dict(trace.metadata_json or {})
    metadata.setdefault("__model_name", trace.model_name)
    metadata.setdefault("__model_provider", trace.model_provider)
    metadata.setdefault("__prompt_version", trace.prompt_version)
    metadata.setdefault("request_id", trace.request_id)
    metadata.setdefault("environment", trace.environment)
    metadata.setdefault("trace_id", trace.trace_id)
    metadata.setdefault("span_id", trace.span_id)
    if trace.parent_span_id is not None:
        metadata.setdefault("parent_span_id", trace.parent_span_id)
    if trace.span_name is not None:
        metadata.setdefault("span_name", trace.span_name)
    if trace.guardrail_policy is not None:
        metadata.setdefault("guardrail_policy", trace.guardrail_policy)
    if trace.guardrail_action is not None:
        metadata.setdefault("guardrail_action", trace.guardrail_action)
    if metadata_overrides:
        metadata.update(metadata_overrides)

    payload = TraceEventV1(
        event_type=event_type,
        trace_id=str(trace.id),
        timestamp=timestamp,
        organization_id=str(trace.organization_id),
        project_id=str(trace.project_id),
        environment_id=str(trace.environment_id) if trace.environment_id is not None else None,
        model=TraceEventModelInfoV1(
            provider=getattr(model_version, "provider", None) or trace.model_provider,
            family=getattr(model_version, "model_family", None) or trace.model_name,
            revision=getattr(model_version, "model_revision", None)
            or getattr(model_version, "model_version", None),
        ),
        prompt_version_id=(
            str(trace.prompt_version_record_id)
            if trace.prompt_version_record_id is not None
            else trace.prompt_version
        ),
        service_name=trace.service_name,
        latency_ms=trace.latency_ms,
        success=trace.success,
        tokens=TraceEventTokensV1(
            input=trace.prompt_tokens,
            output=trace.completion_tokens,
        ),
        cost_usd=_float_or_none(trace.total_cost_usd),
        evaluation=TraceEventEvaluationV1(
            structured_output_valid=structured_output_valid,
            quality_pass=quality_pass,
        ),
        retrieval=TraceEventRetrievalV1(
            latency_ms=trace.retrieval_span.retrieval_latency_ms if trace.retrieval_span is not None else None,
            chunks=trace.retrieval_span.source_count if trace.retrieval_span is not None else None,
        ),
        metadata=metadata,
    ).model_dump(mode="json")
    payload["model_version_id"] = (
        str(trace.model_version_record_id) if trace.model_version_record_id is not None else None
    )
    payload["timestamp"] = _isoformat_utc(timestamp)
    return payload
