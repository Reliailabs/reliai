from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.trace_cohort import TraceCohortAggregation, TraceCohortFilters
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window, trace_window_backend
from app.services.trace_query_router import aggregate_trace_metrics_via_router
from app.services.trace_warehouse import TraceWarehouseAggregateQuery


@dataclass(frozen=True)
class TraceCohortQueryResult:
    backend: str
    items: list


def _query(filters: TraceCohortFilters, *, project: Project) -> TraceWindowQuery:
    return TraceWindowQuery(
        organization_id=project.organization_id,
        project_id=project.id,
        window_start=filters.date_from,
        window_end=filters.date_to,
        prompt_version_record_id=filters.prompt_version_id,
        model_version_record_id=filters.model_version_id,
        latency_min_ms=filters.latency_min_ms,
        latency_max_ms=filters.latency_max_ms,
        success=filters.success,
        structured_output_valid=filters.structured_output_valid,
        with_details=True,
    )


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def query_trace_cohort(
    db: Session,
    *,
    project: Project,
    filters: TraceCohortFilters,
    aggregation: TraceCohortAggregation,
) -> TraceCohortQueryResult:
    query = _query(filters, project=project)
    backend = trace_window_backend(query)
    items = query_trace_window(
        db,
        replace(query, limit=aggregation.sample_limit),
    )
    return TraceCohortQueryResult(backend=backend, items=items)


def aggregate_cohort_metrics(
    db: Session,
    *,
    project: Project,
    filters: TraceCohortFilters,
) -> tuple[str, dict]:
    query = _query(filters, project=project)
    backend = trace_window_backend(query)
    if backend == "postgres":
        traces = query_trace_window(db, query)
        trace_count = len(traces)
        error_rate = (sum(1 for trace in traces if not trace.success) / trace_count) if trace_count else None
        latency_values = [float(trace.latency_ms) for trace in traces if trace.latency_ms is not None]
        structured_values: list[bool] = []
        cost_values = [float(trace.total_cost_usd) for trace in traces if trace.total_cost_usd is not None]
        for trace in traces:
            for evaluation in getattr(trace, "evaluations", []):
                if evaluation.eval_type != "structured_validity":
                    continue
                if evaluation.label == "pass":
                    structured_values.append(True)
                    break
                if evaluation.label == "fail":
                    structured_values.append(False)
                    break
        return backend, {
            "trace_count": trace_count,
            "error_rate": error_rate,
            "average_latency_ms": (sum(latency_values) / len(latency_values)) if latency_values else None,
            "structured_output_validity_rate": (
                sum(1 for value in structured_values if value) / len(structured_values)
                if structured_values
                else None
            ),
            "average_cost_usd": (sum(cost_values) / len(cost_values)) if cost_values else None,
        }

    aggregate_query = TraceWarehouseAggregateQuery(
        organization_id=project.organization_id,
        project_id=project.id,
        window_start=filters.date_from,
        window_end=filters.date_to,
        prompt_version_id=filters.prompt_version_id,
        model_version_id=filters.model_version_id,
        latency_min_ms=filters.latency_min_ms,
        latency_max_ms=filters.latency_max_ms,
        success=filters.success,
        structured_output_valid=filters.structured_output_valid,
    )
    backend, metrics = aggregate_trace_metrics_via_router(aggregate_query)
    if backend != "archive":
        return backend, metrics
    return backend, metrics
