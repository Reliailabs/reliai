import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.project import Project
from app.services.alerts import ALERT_STATUS_PENDING, create_alert_deliveries_for_open_incidents
from app.services.incidents import sync_telemetry_freshness_incident
from app.services.reliability_metrics import compute_project_reliability_metrics
from app.workers.reliability_metrics import enqueue_alert_delivery_jobs

logger = logging.getLogger(__name__)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def run_reliability_sweep_for_session(db, *, anchor_time: str | None = None) -> dict[str, int]:
    computed_at = (
        datetime.fromisoformat(anchor_time).astimezone(timezone.utc)
        if anchor_time is not None
        else datetime.now(timezone.utc)
    )
    projects = db.scalars(select(Project).where(Project.is_active.is_(True)).order_by(Project.created_at)).all()

    processed = 0
    stale_opened = 0
    stale_reopened = 0
    delivery_ids = []

    for project in projects:
        if project.last_trace_received_at is None:
            continue

        freshness_minutes = max(
            0.0,
            (computed_at - _as_utc(project.last_trace_received_at)).total_seconds() / 60.0,
        )
        compute_project_reliability_metrics(db, project=project, anchor_time=computed_at)
        incident_result = sync_telemetry_freshness_incident(
            db,
            project=project,
            freshness_minutes=freshness_minutes,
            detected_at=computed_at,
        )
        deliveries = create_alert_deliveries_for_open_incidents(
            db,
            incidents=incident_result.opened_incidents + incident_result.reopened_incidents,
        )
        delivery_ids.extend(
            delivery.id for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING
        )
        processed += 1
        stale_opened += len(incident_result.opened_incidents)
        stale_reopened += len(incident_result.reopened_incidents)

    db.commit()
    if delivery_ids:
        enqueue_alert_delivery_jobs(delivery_ids)
    result = {
        "processed_projects": processed,
        "stale_incidents_opened": stale_opened,
        "stale_incidents_reopened": stale_reopened,
    }
    logger.info("reliability sweep completed", extra=result)
    return result


def run_reliability_sweep(anchor_time: str | None = None) -> dict[str, int]:
    db = SessionLocal()
    try:
        return run_reliability_sweep_for_session(db, anchor_time=anchor_time)
    finally:
        db.close()
