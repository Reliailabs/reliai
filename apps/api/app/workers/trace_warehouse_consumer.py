from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.trace import Trace
from app.processors.runner import run_processor_runner
from app.services.event_processing_metrics import CONSUMER_TRACE_WAREHOUSE
from app.services.event_stream import TRACE_EVALUATED_EVENT
from app.services.trace_warehouse import ingest_trace_event

logger = logging.getLogger(__name__)


def process_trace_warehouse_event(trace_id: str) -> None:
    db = SessionLocal()
    try:
        trace = db.scalar(
            select(Trace)
            .options(
                selectinload(Trace.retrieval_span),
                selectinload(Trace.evaluations),
                selectinload(Trace.model_version_record),
            )
            .where(Trace.id == UUID(trace_id))
        )
        if trace is None:
            logger.warning("warehouse processor skipped because trace was not found", extra={"trace_id": trace_id})
            return
        ingest_trace_event(trace)
    finally:
        db.close()


def run_trace_warehouse_consumer(*, max_events: int | None = None) -> int:
    return len(
        run_processor_runner(
            max_events=max_events,
            enabled_processors=["warehouse"],
            group_id="reliai.trace-warehouse",
            consumer_name=CONSUMER_TRACE_WAREHOUSE,
            accepted_event_types={TRACE_EVALUATED_EVENT},
        )
    )
