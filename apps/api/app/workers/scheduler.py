from datetime import datetime, timedelta, timezone

from app.db.session import get_queue
from app.workers.reliability_sweep import run_reliability_sweep

RELIABILITY_SWEEP_INTERVAL_MINUTES = 10


def reliability_sweep_job() -> None:
    get_queue().enqueue(run_reliability_sweep, datetime.now(timezone.utc).isoformat())
    schedule_reliability_sweep()


def schedule_reliability_sweep() -> None:
    get_queue().enqueue_in(
        timedelta(minutes=RELIABILITY_SWEEP_INTERVAL_MINUTES),
        reliability_sweep_job,
    )
