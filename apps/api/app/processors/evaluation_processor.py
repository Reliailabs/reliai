from __future__ import annotations

import logging
from uuid import UUID

from app.events import build_trace_event_payload, validate_trace_event
from app.db.session import SessionLocal
from app.core.settings import get_settings
from app.models.trace import Trace
from app.processors.base_processor import BaseProcessor
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.event_stream import TRACE_EVALUATED_EVENT, publish_event

logger = logging.getLogger(__name__)


def process_trace_evaluation(trace_id: str, *, event_payload: dict | None = None) -> None:
    db = SessionLocal()
    try:
        evaluation = run_structured_output_validity_evaluation(db, UUID(trace_id))
        if evaluation is None:
            logger.warning("trace evaluation skipped because trace was not found", extra={"trace_id": trace_id})
            return

        trace = db.get(Trace, UUID(trace_id))
        if trace is None:
            logger.warning(
                "trace evaluation completed but trace was not found for event publication",
                extra={"trace_id": trace_id},
            )
            return

        structured_output_valid = (
            True
            if evaluation.label == "pass"
            else False
            if evaluation.label == "fail"
            else None
        )
        metadata = dict((event_payload or {}).get("metadata") or trace.metadata_json or {})
        metadata["evaluation_result"] = {
            "eval_type": evaluation.eval_type,
            "score": str(evaluation.score) if evaluation.score is not None else None,
            "label": evaluation.label,
            "explanation": evaluation.explanation,
            "raw_result_json": evaluation.raw_result_json,
        }
        payload = validate_trace_event(
            build_trace_event_payload(
                trace,
                event_type=TRACE_EVALUATED_EVENT,
                structured_output_valid=structured_output_valid,
                quality_pass=structured_output_valid,
                metadata_overrides=metadata,
            )
        )
        publish_event(get_settings().event_stream_topic_traces, payload)
    finally:
        db.close()


class EvaluationProcessor(BaseProcessor):
    name = "evaluation"
    topic = get_settings().event_stream_topic_traces

    async def process(self, event) -> None:
        if event.event_type != "trace_ingested":
            return
        process_trace_evaluation(str(event.payload["trace_id"]), event_payload=event.payload)
