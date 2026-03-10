import logging
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.services.deployment_risk_engine import calculate_deployment_risk

logger = logging.getLogger(__name__)


def enqueue_deployment_risk_analysis(*, deployment_id: UUID) -> None:
    try:
        get_queue().enqueue(run_deployment_risk_analysis, str(deployment_id))
    except Exception:
        logger.exception(
            "failed to enqueue deployment risk analysis",
            extra={"deployment_id": str(deployment_id)},
        )


def run_deployment_risk_analysis(deployment_id: str) -> None:
    db = SessionLocal()
    try:
        calculate_deployment_risk(db, deployment_id=UUID(deployment_id))
        db.commit()
    finally:
        db.close()
