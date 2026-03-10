import logging
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.services.reliability_recommendations import generate_recommendations

logger = logging.getLogger(__name__)


def enqueue_project_reliability_recommendations(*, project_id: UUID) -> None:
    try:
        get_queue().enqueue(run_project_reliability_recommendations, str(project_id))
    except Exception:
        logger.exception(
            "failed to enqueue reliability recommendations",
            extra={"project_id": str(project_id)},
        )


def run_project_reliability_recommendations_for_session(db, *, project_id: UUID) -> None:
    generate_recommendations(db, project_id)
    db.commit()


def run_project_reliability_recommendations(project_id: str) -> None:
    db = SessionLocal()
    try:
        run_project_reliability_recommendations_for_session(db, project_id=UUID(project_id))
    finally:
        db.close()
