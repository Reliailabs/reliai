from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

from app.core.settings import get_settings
from app.db.session import get_queue
from app.workers.data_retention_worker import run_data_retention
from app.workers.global_pattern_mining import run_global_pattern_mining
from app.workers.platform_monitor import run_platform_monitor
from app.workers.reliability_graph_mining import run_reliability_graph_mining
from app.workers.reliability_pattern_mining import run_reliability_pattern_mining
from app.workers.usage_expansion_metrics import run_usage_expansion_metrics
from app.workers.reliability_sweep import run_reliability_sweep

RELIABILITY_SWEEP_INTERVAL_MINUTES = 10

try:  # pragma: no cover - optional dependency
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # pragma: no cover - exercised in local/test env
    BackgroundScheduler = None  # type: ignore[assignment]


@dataclass
class SchedulerJobState:
    job_name: str
    interval: timedelta
    enqueue: Callable[[], None]
    status: str = "configured"
    last_run: datetime | None = None
    next_run: datetime | None = None


_SCHEDULER = None
_JOB_STATES: dict[str, SchedulerJobState] = {}


def _enqueue_callable(func, *args) -> None:
    get_queue().enqueue(func, *args)


def reliability_sweep_job() -> None:
    _enqueue_callable(run_reliability_sweep, datetime.now(timezone.utc).isoformat())
    schedule_reliability_sweep()


def schedule_reliability_sweep() -> None:
    get_queue().enqueue_in(
        timedelta(minutes=RELIABILITY_SWEEP_INTERVAL_MINUTES),
        reliability_sweep_job,
    )


def _register_default_jobs() -> dict[str, SchedulerJobState]:
    if _JOB_STATES:
        return _JOB_STATES
    jobs = {
        "reliability_pattern_mining": SchedulerJobState(
            job_name="reliability_pattern_mining",
            interval=timedelta(hours=1),
            enqueue=lambda: _enqueue_callable(run_reliability_pattern_mining),
        ),
        "data_retention_worker": SchedulerJobState(
            job_name="data_retention_worker",
            interval=timedelta(days=1),
            enqueue=lambda: _enqueue_callable(run_data_retention),
        ),
        "reliability_graph_mining": SchedulerJobState(
            job_name="reliability_graph_mining",
            interval=timedelta(hours=1),
            enqueue=lambda: _enqueue_callable(run_reliability_graph_mining),
        ),
        "global_pattern_mining": SchedulerJobState(
            job_name="global_pattern_mining",
            interval=timedelta(hours=1),
            enqueue=lambda: _enqueue_callable(run_global_pattern_mining),
        ),
        "platform_monitor": SchedulerJobState(
            job_name="platform_monitor",
            interval=timedelta(minutes=2),
            enqueue=lambda: _enqueue_callable(run_platform_monitor),
        ),
        "usage_expansion_metrics": SchedulerJobState(
            job_name="usage_expansion_metrics",
            interval=timedelta(hours=1),
            enqueue=lambda: _enqueue_callable(run_usage_expansion_metrics),
        ),
    }
    now = datetime.now(timezone.utc)
    for state in jobs.values():
        state.next_run = now + state.interval
    _JOB_STATES.update(jobs)
    return _JOB_STATES


def _run_and_track(job_name: str) -> None:
    state = _JOB_STATES[job_name]
    state.enqueue()
    now = datetime.now(timezone.utc)
    state.last_run = now
    state.next_run = now + state.interval
    state.status = "scheduled"


def start_scheduler() -> None:
    global _SCHEDULER
    settings = get_settings()
    jobs = _register_default_jobs()
    if not settings.scheduler_enabled:
        for state in jobs.values():
            state.status = "disabled"
        return
    if BackgroundScheduler is None:
        for state in jobs.values():
            state.status = "configured"
        return
    if _SCHEDULER is not None:
        return
    scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)
    for state in jobs.values():
        scheduler.add_job(
            _run_and_track,
            "interval",
            seconds=int(state.interval.total_seconds()),
            args=[state.job_name],
            id=state.job_name,
            replace_existing=True,
        )
        state.status = "scheduled"
    scheduler.start()
    _SCHEDULER = scheduler


def get_scheduler_status() -> list[dict[str, object]]:
    jobs = _register_default_jobs()
    return [
        {
            "job_name": state.job_name,
            "last_run": state.last_run,
            "next_run": state.next_run,
            "status": state.status,
        }
        for state in jobs.values()
    ]
