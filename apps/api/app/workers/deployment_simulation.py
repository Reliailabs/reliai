import logging
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.services.deployment_simulation_engine import simulate_deployment

logger = logging.getLogger(__name__)


def enqueue_deployment_simulation(*, simulation_id: UUID) -> None:
    try:
        get_queue().enqueue(run_deployment_simulation, str(simulation_id))
    except Exception:
        logger.exception(
            "failed to enqueue deployment simulation",
            extra={"simulation_id": str(simulation_id)},
        )


def run_deployment_simulation(simulation_id: str) -> None:
    db = SessionLocal()
    try:
        simulate_deployment(db, simulation_id=UUID(simulation_id))
        db.commit()
    finally:
        db.close()
