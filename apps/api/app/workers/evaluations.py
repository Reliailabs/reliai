import logging
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.processors.evaluation_processor import process_trace_evaluation
from app.services.alerts import (
    mark_delivery_enqueue_failed,
)
from app.workers.alerts import run_alert_delivery

logger = logging.getLogger(__name__)


def enqueue_alert_delivery_job(delivery_id: UUID) -> None:
    try:
        get_queue().enqueue(run_alert_delivery, str(delivery_id))
    except Exception as exc:
        logger.exception("failed to enqueue alert delivery", extra={"delivery_id": str(delivery_id)})
        follow_up_session = SessionLocal()
        try:
            mark_delivery_enqueue_failed(follow_up_session, delivery_id, str(exc))
        finally:
            follow_up_session.close()


def run_trace_evaluations(trace_id: str) -> None:
    process_trace_evaluation(trace_id)
