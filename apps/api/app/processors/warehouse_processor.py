from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.trace import Trace
from app.processors.base_processor import BaseProcessor
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
            )
            .where(Trace.id == UUID(trace_id))
        )
        if trace is None:
            logger.warning("warehouse processor skipped because trace was not found", extra={"trace_id": trace_id})
            return
        ingest_trace_event(trace)
    finally:
        db.close()


class WarehouseProcessor(BaseProcessor):
    name = "warehouse"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != "trace_ingested":
            return
        process_trace_warehouse_event(str(event.payload["trace_id"]))
