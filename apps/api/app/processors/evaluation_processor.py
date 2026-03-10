from __future__ import annotations

import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.core.settings import get_settings
from app.processors.base_processor import BaseProcessor
from app.services.evaluations import run_structured_output_validity_evaluation

logger = logging.getLogger(__name__)


def process_trace_evaluation(trace_id: str) -> None:
    db = SessionLocal()
    try:
        evaluation = run_structured_output_validity_evaluation(db, UUID(trace_id))
        if evaluation is None:
            logger.warning("trace evaluation skipped because trace was not found", extra={"trace_id": trace_id})
    finally:
        db.close()


class EvaluationProcessor(BaseProcessor):
    name = "evaluation"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != "trace_ingested":
            return
        process_trace_evaluation(str(event.payload["trace_id"]))
