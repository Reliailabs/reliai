from datetime import datetime, timezone

from app.db.session import SessionLocal, get_queue
from app.services.reliability_pattern_mining import mine_patterns_last_7_days, update_probability_scores


def enqueue_reliability_pattern_mining(*, anchor_time: datetime | None = None) -> None:
    get_queue().enqueue(
        run_reliability_pattern_mining,
        anchor_time.isoformat() if anchor_time is not None else None,
    )


def run_reliability_pattern_mining_for_session(db, *, anchor_time: str | None = None) -> None:
    computed_at = (
        datetime.fromisoformat(anchor_time).astimezone(timezone.utc)
        if anchor_time is not None
        else datetime.now(timezone.utc)
    )
    mine_patterns_last_7_days(db, anchor_time=computed_at)
    update_probability_scores(db, anchor_time=computed_at)
    db.commit()


def run_reliability_pattern_mining(anchor_time: str | None = None) -> None:
    db = SessionLocal()
    try:
        run_reliability_pattern_mining_for_session(db, anchor_time=anchor_time)
    finally:
        db.close()
