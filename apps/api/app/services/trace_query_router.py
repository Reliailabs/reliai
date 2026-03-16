from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.services.trace_warehouse import (
    MAX_EVENT_WINDOW,
    TraceWarehouseAggregateQuery,
    TraceWarehouseQuery,
    TraceWarehouseRollupRow,
    WarehouseQueryViolation,
    _aggregate_trace_metrics,
    _count_distinct_services,
    _query_all_traces,
    _query_daily_metrics,
    _query_hourly_metrics,
    _query_traces,
    contextvar_router_active,
    get_warehouse_stats,
)

HOURLY_ROLLUP_WINDOW = timedelta(days=30)
ROLLUP_RETENTION_WINDOW = timedelta(days=90)


@dataclass(frozen=True)
class TraceQueryRequest:
    window_start: datetime
    window_end: datetime
    aggregated: bool = False


def route_trace_query(request: TraceQueryRequest) -> str:
    window = request.window_end - request.window_start
    if request.aggregated and window > ROLLUP_RETENTION_WINDOW:
        return "archive"
    if window <= MAX_EVENT_WINDOW:
        return "warehouse"
    if request.aggregated:
        return "rollup_hourly" if window <= HOURLY_ROLLUP_WINDOW else "rollup_daily"
    return "archive"


def query_trace_rows_via_router(query: TraceWarehouseQuery) -> tuple[str, list]:
    if query.window_end - query.window_start > MAX_EVENT_WINDOW:
        raise WarehouseQueryViolation("Raw trace queries cannot exceed 24 hours.")
    route = route_trace_query(
        TraceQueryRequest(
            window_start=query.window_start,
            window_end=query.window_end,
            aggregated=False,
        )
    )
    if route == "archive":
        return route, []
    token = contextvar_router_active.set(True)
    try:
        return route, _query_traces(query)
    finally:
        contextvar_router_active.reset(token)


def aggregate_trace_metrics_via_router(query: TraceWarehouseAggregateQuery) -> tuple[str, dict[str, Any]]:
    route = route_trace_query(
        TraceQueryRequest(
            window_start=query.window_start,
            window_end=query.window_end,
            aggregated=True,
        )
    )
    if route == "archive":
        return route, {
            "trace_count": 0,
            "success_rate": None,
            "error_rate": None,
            "average_latency_ms": None,
            "structured_output_validity_rate": None,
            "average_cost_usd": None,
        }
    if route == "warehouse":
        token = contextvar_router_active.set(True)
        try:
            return route, _aggregate_trace_metrics(query)
        finally:
            contextvar_router_active.reset(token)
    rollups = (
        query_hourly_metrics(
            project_id=query.project_id,
            environment_id=query.environment_id,
            start_time=query.window_start,
            end_time=query.window_end,
        )
        if route == "rollup_hourly"
        else query_daily_metrics(
            project_id=query.project_id,
            environment_id=query.environment_id,
            start_time=query.window_start,
            end_time=query.window_end,
        )
    )
    return route, _aggregate_rollup_rows(rollups)


def query_all_traces_via_router(
    *,
    window_start: datetime,
    window_end: datetime,
    aggregated: bool = False,
    limit: int | None = None,
) -> tuple[str, list]:
    if not aggregated and window_end - window_start > MAX_EVENT_WINDOW:
        raise WarehouseQueryViolation("Raw trace queries cannot exceed 24 hours.")
    route = route_trace_query(
        TraceQueryRequest(
            window_start=window_start,
            window_end=window_end,
            aggregated=aggregated,
        )
    )
    if route == "archive":
        return route, []
    token = contextvar_router_active.set(True)
    try:
        return route, _query_all_traces(window_start=window_start, window_end=window_end, limit=limit)
    finally:
        contextvar_router_active.reset(token)


def query_rollups_via_router(
    *,
    project_id,
    environment_id,
    window_start: datetime,
    window_end: datetime,
) -> tuple[str, list[TraceWarehouseRollupRow]]:
    route = route_trace_query(
        TraceQueryRequest(
            window_start=window_start,
            window_end=window_end,
            aggregated=True,
        )
    )
    if route == "archive":
        return route, []
    if route == "warehouse":
        raise WarehouseQueryViolation("Long-window analytics must use rollup tables.")
    if route == "rollup_hourly":
        return route, query_hourly_metrics(
            project_id=project_id,
            environment_id=environment_id,
            start_time=window_start,
            end_time=window_end,
        )
    return route, query_daily_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=window_start,
        end_time=window_end,
    )


def warehouse_platform_metrics(*, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    return get_warehouse_stats(window_start=window_start, window_end=window_end)


def query_recent_traces(query: TraceWarehouseQuery) -> list:
    return query_trace_rows_via_router(query)[1]


def query_hourly_metrics(
    *,
    project_id,
    environment_id,
    start_time: datetime,
    end_time: datetime,
) -> list[TraceWarehouseRollupRow]:
    token = contextvar_router_active.set(True)
    try:
        return _query_hourly_metrics(
            project_id=project_id,
            environment_id=environment_id,
            start_time=start_time,
            end_time=end_time,
        )
    finally:
        contextvar_router_active.reset(token)


def query_daily_metrics(
    *,
    project_id,
    environment_id,
    start_time: datetime,
    end_time: datetime,
) -> list[TraceWarehouseRollupRow]:
    token = contextvar_router_active.set(True)
    try:
        return _query_daily_metrics(
            project_id=project_id,
            environment_id=environment_id,
            start_time=start_time,
            end_time=end_time,
        )
    finally:
        contextvar_router_active.reset(token)


def aggregate_trace_metrics(query: TraceWarehouseAggregateQuery) -> dict[str, Any]:
    return aggregate_trace_metrics_via_router(query)[1]


def count_distinct_services(
    *,
    organization_id,
    project_id,
    environment_id,
    window_start: datetime,
    window_end: datetime,
) -> int:
    route = route_trace_query(
        TraceQueryRequest(
            window_start=window_start,
            window_end=window_end,
            aggregated=False,
        )
    )
    if route == "archive":
        return 0
    token = contextvar_router_active.set(True)
    try:
        return _count_distinct_services(
            organization_id=organization_id,
            project_id=project_id,
            environment_id=environment_id,
            window_start=window_start,
            window_end=window_end,
        )
    finally:
        contextvar_router_active.reset(token)


def _aggregate_rollup_rows(rows: list[TraceWarehouseRollupRow]) -> dict[str, Any]:
    trace_count = sum(row.trace_count for row in rows)
    if trace_count <= 0:
        return {
            "trace_count": 0,
            "success_rate": None,
            "error_rate": None,
            "average_latency_ms": None,
            "structured_output_validity_rate": None,
            "average_cost_usd": None,
        }
    success_weight = sum((row.success_rate or 0.0) * row.trace_count for row in rows)
    latency_weight = sum((row.latency_avg or 0.0) * row.trace_count for row in rows if row.latency_avg is not None)
    latency_count = sum(row.trace_count for row in rows if row.latency_avg is not None)
    total_cost = sum(row.cost_usd for row in rows)
    success_rate = success_weight / trace_count
    return {
        "trace_count": trace_count,
        "success_rate": success_rate,
        "error_rate": 1 - success_rate,
        "average_latency_ms": (latency_weight / latency_count) if latency_count else None,
        "structured_output_validity_rate": None,
        "average_cost_usd": total_cost / trace_count,
    }
