from __future__ import annotations

import logging
from uuid import UUID

from app.events import build_trace_event_payload, validate_trace_event
from app.db.session import SessionLocal
from app.core.settings import get_settings
from app.models.trace import Trace
from app.processors.base_processor import BaseProcessor
from app.services.evaluations import (
    run_project_custom_metric_evaluations,
    run_refusal_detection_evaluation,
    run_structured_output_validity_evaluation,
)
from app.services.event_stream import TRACE_EVALUATED_EVENT, publish_event

logger = logging.getLogger(__name__)


def process_trace_evaluation(trace_id: str, *, event_payload: dict | None = None) -> None:
    db = SessionLocal()
    try:
        structured_evaluation = run_structured_output_validity_evaluation(db, UUID(trace_id))
        if structured_evaluation is None:
            logger.warning("trace evaluation skipped because trace was not found", extra={"trace_id": trace_id})
            return
        refusal_evaluation = run_refusal_detection_evaluation(db, UUID(trace_id))
        custom_metric_evaluations = run_project_custom_metric_evaluations(db, UUID(trace_id))

        trace = db.get(Trace, UUID(trace_id))
        if trace is None:
            logger.warning(
                "trace evaluation completed but trace was not found for event publication",
                extra={"trace_id": trace_id},
            )
            return

        structured_output_valid = (
            True
            if structured_evaluation.label == "pass"
            else False
            if structured_evaluation.label == "fail"
            else None
        )
        metadata = dict((event_payload or {}).get("metadata") or trace.metadata_json or {})
        metadata["evaluation_result"] = {
            "eval_type": structured_evaluation.eval_type,
            "score": str(structured_evaluation.score) if structured_evaluation.score is not None else None,
            "label": structured_evaluation.label,
            "explanation": structured_evaluation.explanation,
            "raw_result_json": structured_evaluation.raw_result_json,
        }
        metadata["behavior_signals"] = {
            "refusal_detected": (
                bool((refusal_evaluation.raw_result_json or {}).get("result_value"))
                if refusal_evaluation is not None
                else None
            ),
            "custom_metrics": [
                {
                    "eval_type": evaluation.eval_type,
                    "label": evaluation.label,
                    "result": (evaluation.raw_result_json or {}).get("result_value"),
                }
                for evaluation in custom_metric_evaluations
            ],
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
