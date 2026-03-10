import os
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select

from app.core.settings import get_settings
from app.models.incident import Incident
from app.models.reliability_metric import ReliabilityMetric
from app.services.reliability_metrics import (
    METRIC_DETECTION_COVERAGE,
    METRIC_EXPLAINABILITY_SCORE,
    METRIC_INCIDENT_DENSITY,
    METRIC_TELEMETRY_FRESHNESS_MINUTES,
)
from app.workers.reliability_sweep import run_reliability_sweep_for_session
from app.workers.scheduler import RELIABILITY_SWEEP_INTERVAL_MINUTES, reliability_sweep_job, schedule_reliability_sweep
from .test_reliability_metrics import _seed_metric_inputs


def _set_env(name: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value
    get_settings.cache_clear()


def _latest_metric(db_session, project_id: UUID, metric_name: str) -> ReliabilityMetric:
    row = db_session.scalar(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == project_id,
            ReliabilityMetric.scope_type == "project",
            ReliabilityMetric.scope_id == str(project_id),
            ReliabilityMetric.metric_name == metric_name,
        )
        .order_by(ReliabilityMetric.window_end.desc())
    )
    assert row is not None
    return row


def test_idle_project_sweep_recomputes_metrics(client, db_session, fake_queue):
    project, anchor = _seed_metric_inputs(client, db_session)

    result = run_reliability_sweep_for_session(db_session, anchor_time=anchor.isoformat())

    assert result["processed_projects"] >= 1
    assert _latest_metric(db_session, project.id, METRIC_TELEMETRY_FRESHNESS_MINUTES).value_number == 20.0
    assert _latest_metric(db_session, project.id, METRIC_EXPLAINABILITY_SCORE).value_number == 0.5
    assert _latest_metric(db_session, project.id, METRIC_DETECTION_COVERAGE).value_number == 0.5
    assert _latest_metric(db_session, project.id, METRIC_INCIDENT_DENSITY).value_number > 0


def test_stale_telemetry_incident_created_by_sweep(client, db_session, fake_queue):
    _set_env("RELIABILITY_STALE_TELEMETRY_MINUTES", "30")
    project, anchor = _seed_metric_inputs(client, db_session)
    project.last_trace_received_at = anchor - timedelta(minutes=45)
    db_session.add(project)
    db_session.commit()

    result = run_reliability_sweep_for_session(db_session, anchor_time=anchor.isoformat())

    incident = db_session.scalar(
        select(Incident).where(
            Incident.project_id == project.id,
            Incident.incident_type == "telemetry_freshness_stale",
        )
    )
    assert result["stale_incidents_opened"] == 1
    assert incident is not None
    assert incident.status == "open"
    assert incident.summary_json["baseline_value"] == 30


def test_reliability_sweep_is_idempotent_for_stale_incident(client, db_session, fake_queue):
    _set_env("RELIABILITY_STALE_TELEMETRY_MINUTES", "30")
    project, anchor = _seed_metric_inputs(client, db_session)
    project.last_trace_received_at = anchor - timedelta(minutes=90)
    db_session.add(project)
    db_session.commit()

    first = run_reliability_sweep_for_session(db_session, anchor_time=anchor.isoformat())
    second = run_reliability_sweep_for_session(db_session, anchor_time=(anchor + timedelta(minutes=10)).isoformat())

    incidents = db_session.scalars(
        select(Incident).where(
            Incident.project_id == project.id,
            Incident.incident_type == "telemetry_freshness_stale",
        )
    ).all()
    assert len(incidents) == 1
    assert first["stale_incidents_opened"] == 1
    assert second["stale_incidents_opened"] == 0


def test_scheduler_enqueues_reliability_sweep(fake_queue):
    reliability_sweep_job()
    schedule_reliability_sweep()

    assert any(getattr(job[0], "__name__", "") == "run_reliability_sweep" for job in fake_queue.jobs)
    delayed_jobs = [job for job in fake_queue.jobs if getattr(job[0], "__name__", "") == "reliability_sweep_job"]
    assert delayed_jobs
    assert delayed_jobs[0][2]["delay"] == timedelta(minutes=RELIABILITY_SWEEP_INTERVAL_MINUTES)
