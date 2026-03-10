from __future__ import annotations

from app.processors.runner import run_processor_runner
from app.processors.warehouse_processor import process_trace_warehouse_event as process_trace_warehouse_event_sync
from app.services.event_processing_metrics import CONSUMER_TRACE_WAREHOUSE


def process_trace_warehouse_event(trace_id: str) -> None:
    process_trace_warehouse_event_sync(trace_id)


def run_trace_warehouse_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["warehouse"],
            group_id="reliai.trace-warehouse",
            consumer_name=CONSUMER_TRACE_WAREHOUSE,
        )
    )
