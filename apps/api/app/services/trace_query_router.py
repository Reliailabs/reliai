from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, status

from app.services.trace_warehouse import (
    TraceWarehouseAggregateQuery,
    TraceWarehouseQuery,
    aggregate_trace_metrics,
    get_warehouse_stats,
    query_all_traces,
    query_traces,
)

RECENT_WAREHOUSE_WINDOW = timedelta(hours=24)
ARCHIVE_WINDOW = timedelta(days=30)


class WarehouseQueryViolation(HTTPException):
    def __init__(self, detail: str = "Warehouse-backed query required for this time window") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


@dataclass(frozen=True)
class TraceQueryRequest:
    window_start: datetime
    window_end: datetime
    aggregated: bool = False


def route_trace_query(request: TraceQueryRequest) -> str:
    window = request.window_end - request.window_start
    if window > ARCHIVE_WINDOW:
        return "archive"
    if request.aggregated:
        return "rollup_daily" if window >= timedelta(days=7) else "rollup_hourly"
    return "warehouse" if window <= RECENT_WAREHOUSE_WINDOW else "archive"


def query_trace_rows_via_router(query: TraceWarehouseQuery) -> tuple[str, list]:
    route = route_trace_query(
        TraceQueryRequest(
            window_start=query.window_start,
            window_end=query.window_end,
            aggregated=False,
        )
    )
    if route == "archive":
        return route, []
    return route, query_traces(query)


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
    return route, aggregate_trace_metrics(query)


def query_all_traces_via_router(
    *,
    window_start: datetime,
    window_end: datetime,
    aggregated: bool = False,
    limit: int | None = None,
) -> tuple[str, list]:
    route = route_trace_query(
        TraceQueryRequest(
            window_start=window_start,
            window_end=window_end,
            aggregated=aggregated,
        )
    )
    if route == "archive":
        return route, []
    return route, query_all_traces(window_start=window_start, window_end=window_end, limit=limit)


def warehouse_platform_metrics(*, window_start: datetime, window_end: datetime) -> dict[str, Any]:
    return get_warehouse_stats(window_start=window_start, window_end=window_end)
