from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.trace import Trace
from app.services.trace_warehouse import ingest_trace_event

logger = logging.getLogger(__name__)


def run_trace_warehouse_ingest(trace_id: str) -> None:
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
            logger.warning("warehouse ingestion skipped because trace was not found", extra={"trace_id": trace_id})
            return
        ingest_trace_event(trace)
    finally:
        db.close()
