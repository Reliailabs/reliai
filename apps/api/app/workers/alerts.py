import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.services.alerts import deliver_alert_delivery

logger = logging.getLogger(__name__)


def run_alert_delivery(delivery_id: str) -> None:
    db = SessionLocal()
    try:
        delivery = deliver_alert_delivery(db, UUID(delivery_id))
        if delivery is None:
            logger.warning(
                "alert delivery skipped because delivery was not found",
                extra={"delivery_id": delivery_id},
            )
    finally:
        db.close()
