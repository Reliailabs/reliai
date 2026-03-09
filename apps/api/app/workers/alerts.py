import logging
from datetime import timedelta
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.services.alerts import deliver_alert_delivery

logger = logging.getLogger(__name__)


def enqueue_alert_delivery_retry(*, delivery_id: UUID, delay_seconds: int) -> None:
    get_queue().enqueue_in(timedelta(seconds=delay_seconds), run_alert_delivery, str(delivery_id))


def run_alert_delivery(delivery_id: str) -> None:
    db = SessionLocal()
    try:
        delivery = deliver_alert_delivery(db, UUID(delivery_id))
        if delivery is None:
            logger.warning(
                "alert delivery skipped because delivery was not found",
                extra={"delivery_id": delivery_id},
            )
            return
        if delivery.delivery_status == "pending" and delivery.next_attempt_at is not None:
            delay_seconds = max(
                0,
                int((delivery.next_attempt_at - delivery.last_attempted_at).total_seconds())
                if delivery.last_attempted_at is not None
                else 0,
            )
            if delay_seconds > 0:
                enqueue_alert_delivery_retry(delivery_id=delivery.id, delay_seconds=delay_seconds)
    finally:
        db.close()
