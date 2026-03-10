from datetime import datetime, timezone

from app.db.session import SessionLocal, get_queue
from app.services.global_metrics import aggregate_global_model_reliability


def enqueue_global_metrics_aggregation(*, anchor_time: datetime | None = None) -> None:
    get_queue().enqueue(
        run_global_metrics_aggregation,
        anchor_time.isoformat() if anchor_time is not None else None,
    )


def run_global_metrics_aggregation_for_session(db, *, anchor_time: str | None = None) -> None:
    computed_at = (
        datetime.fromisoformat(anchor_time).astimezone(timezone.utc)
        if anchor_time is not None
        else datetime.now(timezone.utc)
    )
    aggregate_global_model_reliability(db, computed_at=computed_at)
    db.commit()


def run_global_metrics_aggregation(anchor_time: str | None = None) -> None:
    db = SessionLocal()
    try:
        run_global_metrics_aggregation_for_session(db, anchor_time=anchor_time)
    finally:
        db.close()
