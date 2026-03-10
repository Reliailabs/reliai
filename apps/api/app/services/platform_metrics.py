from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.processor_failure import ProcessorFailure
from app.models.project import Project
from app.models.trace import Trace
from app.services.event_processing_metrics import get_event_pipeline_status
from app.services.trace_warehouse import query_all_traces


def get_platform_metrics(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=15)
    pipeline = get_event_pipeline_status(db)
    traces_recent = int(
        db.scalar(select(func.count(Trace.id)).where(Trace.created_at >= window_start)) or 0
    )
    failures_recent = int(
        db.scalar(select(func.count(ProcessorFailure.id)).where(ProcessorFailure.created_at >= window_start)) or 0
    )
    warehouse_recent = len(query_all_traces(window_start=window_start, window_end=now))
    warehouse_lag = max(traces_recent - warehouse_recent, 0)
    processor_failure_rate = round(failures_recent / traces_recent, 4) if traces_recent else 0.0
    overload = "normal"
    if warehouse_lag >= 1000 or processor_failure_rate >= 0.05:
        overload = "critical"
    elif warehouse_lag >= 100 or processor_failure_rate >= 0.01:
        overload = "high"
    avg_latency = None
    consumer_latencies = [
        consumer.average_processing_latency_ms
        for consumer in pipeline.consumers
        if consumer.average_processing_latency_ms is not None
    ]
    if consumer_latencies:
        avg_latency = round(sum(consumer_latencies) / len(consumer_latencies), 2)
    return {
        "trace_ingest_rate": round(traces_recent / 15, 2),
        "pipeline_latency": avg_latency,
        "processor_failure_rate": processor_failure_rate,
        "warehouse_lag": warehouse_lag,
        "customer_overload_risk": overload,
    }


def get_platform_monitor_snapshot(db: Session) -> dict:
    metrics = get_platform_metrics(db)
    metrics["active_projects"] = int(db.scalar(select(func.count(Project.id)).where(Project.is_active.is_(True))) or 0)
    return metrics
