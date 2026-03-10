from __future__ import annotations

from app.workers.trace_warehouse_consumer import process_trace_warehouse_event


def run_trace_warehouse_ingest(trace_id: str) -> None:
    # Compatibility wrapper for existing tests and scripts while the event stream
    # becomes the primary trigger path.
    process_trace_warehouse_event(trace_id)
