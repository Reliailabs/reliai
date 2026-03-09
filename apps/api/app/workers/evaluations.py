import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.services.evaluations import run_structured_output_validity_evaluation

logger = logging.getLogger(__name__)


def run_trace_evaluations(trace_id: str) -> None:
    db = SessionLocal()
    try:
        evaluation = run_structured_output_validity_evaluation(db, UUID(trace_id))
        if evaluation is None:
            logger.warning("trace evaluation skipped because trace was not found", extra={"trace_id": trace_id})
    finally:
        db.close()
