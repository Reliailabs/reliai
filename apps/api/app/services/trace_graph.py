from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trace import Trace
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access


def _span_type(trace: Trace) -> str | None:
    metadata = trace.metadata_json or {}
    value = metadata.get("span_type")
    if isinstance(value, str) and value.strip():
        return value
    if trace.guardrail_policy:
        return "guardrail"
    if trace.span_name:
        normalized = trace.span_name.lower()
        if normalized in {"retrieval", "prompt", "prompt_build", "llm", "llm_call", "tool", "tool_call", "postprocess"}:
            return normalized
    return None


def _graph_traces(db: Session, trace_id: str) -> list[Trace]:
    return db.scalars(
        select(Trace)
        .where(Trace.trace_id == trace_id)
        .order_by(Trace.timestamp.asc(), Trace.created_at.asc(), Trace.id.asc())
    ).all()


def _required_graph_traces(db: Session, operator: OperatorContext, trace_id: str) -> list[Trace]:
    traces = _graph_traces(db, trace_id)
    if not traces:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace graph not found")

    require_project_access(db, operator, traces[0].project_id)
    return traces


def get_trace_graph(db: Session, operator: OperatorContext, trace_id: str) -> dict:
    traces = _required_graph_traces(db, operator, trace_id)
    root = traces[0]

    return {
        "trace_id": trace_id,
        "project_id": root.project_id,
        "environment": root.environment,
        "nodes": [
            {
                "id": trace.id,
                "trace_id": trace.trace_id,
                "span_id": trace.span_id,
                "parent_span_id": trace.parent_span_id,
                "span_name": trace.span_name,
                "span_type": _span_type(trace),
                "model_name": trace.model_name,
                "model_provider": trace.model_provider,
                "latency_ms": trace.latency_ms,
                "prompt_tokens": trace.prompt_tokens,
                "completion_tokens": trace.completion_tokens,
                "success": trace.success,
                "guardrail_policy": trace.guardrail_policy,
                "guardrail_action": trace.guardrail_action,
                "timestamp": trace.timestamp,
                "metadata_json": trace.metadata_json,
            }
            for trace in traces
        ],
        "edges": [
            {
                "parent_span_id": trace.parent_span_id,
                "child_span_id": trace.span_id,
            }
            for trace in traces
            if trace.parent_span_id
        ],
    }


def get_trace_graph_analysis(db: Session, operator: OperatorContext, trace_id: str) -> dict:
    traces = _required_graph_traces(db, operator, trace_id)

    slowest = max(
        (trace for trace in traces if trace.latency_ms is not None),
        key=lambda trace: trace.latency_ms or 0,
        default=None,
    )
    largest_token = max(
        traces,
        key=lambda trace: (trace.prompt_tokens or 0) + (trace.completion_tokens or 0),
        default=None,
    )
    retry_counts: dict[tuple[str | None, str | None], int] = {}
    for trace in traces:
        if trace.guardrail_action != "retry":
            continue
        key = (trace.span_id, trace.guardrail_policy)
        retry_counts[key] = retry_counts.get(key, 0) + 1
    top_retry: tuple[tuple[str | None, str | None], int] | None = None
    if retry_counts:
        top_retry = max(retry_counts.items(), key=lambda item: item[1])

    def _span_payload(trace: Trace | None, *, retry_count: int | None = None) -> dict | None:
        if trace is None:
            return None
        return {
            "span_id": trace.span_id,
            "span_name": trace.span_name,
            "span_type": _span_type(trace),
            "latency_ms": trace.latency_ms,
            "token_count": (trace.prompt_tokens or 0) + (trace.completion_tokens or 0) or None,
            "guardrail_policy": trace.guardrail_policy,
            "retry_count": retry_count,
        }

    retry_trace = None
    retry_count = None
    if top_retry is not None:
        (retry_span_id, retry_policy), retry_count = top_retry
        retry_trace = next(
            (
                trace
                for trace in traces
                if trace.span_id == retry_span_id and trace.guardrail_policy == retry_policy
            ),
            None,
        )

    return {
        "trace_id": trace_id,
        "slowest_span": _span_payload(slowest),
        "largest_token_span": _span_payload(
            largest_token if ((largest_token.prompt_tokens or 0) + (largest_token.completion_tokens or 0)) > 0 else None
        ),
        "most_guardrail_retries": _span_payload(retry_trace, retry_count=retry_count),
    }
