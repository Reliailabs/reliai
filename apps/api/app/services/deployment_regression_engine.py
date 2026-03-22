from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.trace import Trace

WINDOW_MINUTES = 60


@dataclass(frozen=True)
class RegressionMetrics:
    trace_count: int
    failures: int
    retries: int
    p95_latency_ms: float
    documents_found: float


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _percentile(values: list[int], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = max(0, ceil(len(sorted_values) * percentile) - 1)
    return float(sorted_values[index])


def _trace_window_query(
    db: Session,
    *,
    deployment: Deployment,
    window_start: datetime,
    window_end: datetime,
) -> list[Trace]:
    statement = (
        select(Trace)
        .options(
            selectinload(Trace.graph_retrieval_span),
            selectinload(Trace.retrieval_span),
        )
        .where(
            Trace.project_id == deployment.project_id,
            Trace.timestamp >= window_start,
            Trace.timestamp < window_end,
        )
        .order_by(desc(Trace.timestamp), desc(Trace.id))
    )
    if deployment.prompt_version_id is not None:
        statement = statement.where(Trace.prompt_version_record_id == deployment.prompt_version_id)
    if deployment.model_version_id is not None:
        statement = statement.where(Trace.model_version_record_id == deployment.model_version_id)
    return db.scalars(statement).unique().all()


def _retry_attempt(trace: Trace) -> int:
    attributes = {}
    if isinstance(trace.metadata_json, dict):
        otel = trace.metadata_json.get("otel")
        if isinstance(otel, dict):
            attributes = otel.get("attributes") or {}
    value = attributes.get("retry_attempt")
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return 0


def _documents_found(trace: Trace) -> int | None:
    if trace.graph_retrieval_span is not None and trace.graph_retrieval_span.chunk_count is not None:
        return trace.graph_retrieval_span.chunk_count
    if trace.retrieval_span is not None and trace.retrieval_span.source_count is not None:
        return trace.retrieval_span.source_count
    return None


def _window_metrics(traces: list[Trace]) -> RegressionMetrics:
    latency_values = [trace.latency_ms for trace in traces if trace.latency_ms is not None]
    failures = sum(1 for trace in traces if not trace.success)
    retries = sum(1 for trace in traces if _retry_attempt(trace) > 0)
    documents = [value for trace in traces if (value := _documents_found(trace)) is not None]
    documents_avg = sum(documents) / len(documents) if documents else 0.0
    return RegressionMetrics(
        trace_count=len(traces),
        failures=failures,
        retries=retries,
        p95_latency_ms=_percentile(latency_values, 0.95),
        documents_found=documents_avg,
    )


def build_deployment_regression_risk(db: Session, *, deployment: Deployment) -> dict[str, Any]:
    current_start = _as_utc(deployment.deployed_at)
    baseline_start = current_start - timedelta(minutes=WINDOW_MINUTES)
    current_end = current_start + timedelta(minutes=WINDOW_MINUTES)
    baseline_traces = _trace_window_query(
        db,
        deployment=deployment,
        window_start=baseline_start,
        window_end=current_start,
    )
    current_traces = _trace_window_query(
        db,
        deployment=deployment,
        window_start=current_start,
        window_end=current_end,
    )
    baseline_metrics = _window_metrics(baseline_traces)
    current_metrics = _window_metrics(current_traces)

    if baseline_metrics.trace_count == 0 or current_metrics.trace_count == 0:
        return {"is_regression": False, "reasons": []}

    reasons: list[str] = []
    failure_delta = current_metrics.failures - baseline_metrics.failures
    retry_delta = current_metrics.retries - baseline_metrics.retries
    latency_delta = current_metrics.p95_latency_ms - baseline_metrics.p95_latency_ms
    documents_delta = current_metrics.documents_found - baseline_metrics.documents_found

    if failure_delta > 1:
        reasons.append(f"failures increased (+{failure_delta})")
    if retry_delta > 1:
        reasons.append(f"retries increased (+{retry_delta})")
    if latency_delta > 50:
        reasons.append(f"latency increased (+{round(latency_delta)}ms)")
    if documents_delta < -1:
        reasons.append(f"documents_found decreased ({round(documents_delta, 1)})")

    return {"is_regression": bool(reasons), "reasons": reasons}
