import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.project import Project
from app.services.alerts import ALERT_STATUS_PENDING, create_alert_deliveries_for_open_incidents
from app.services.incidents import (
    IncidentSyncResult,
    sync_incidents_for_scope,
    sync_telemetry_freshness_incident,
)
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import RollupScope
from app.services.reliability_metrics import compute_project_reliability_metrics
from app.workers.reliability_intelligence import enqueue_reliability_intelligence_aggregation
from app.workers.reliability_recommendations import enqueue_project_reliability_recommendations
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
    settings = get_settings()
    projects = db.scalars(select(Project).where(Project.is_active.is_(True)).order_by(Project.created_at)).all()

    processed = 0
    stale_opened = 0
    stale_reopened = 0
    delivery_ids = []
    recommendation_project_ids = []

    for project in projects:
        if project.last_trace_received_at is None:
            continue

        freshness_minutes = max(
            0.0,
            (computed_at - _as_utc(project.last_trace_received_at)).total_seconds() / 60.0,
        )
        compute_project_reliability_metrics(db, project=project, anchor_time=computed_at)
        # In dev, optionally run regression detection inline so incidents can open
        # without the async event pipeline.
        if (
            settings.dev_inline_regression
            and settings.app_env.lower() in {"development", "dev", "local"}
        ):
            regression_result = compute_regressions_for_scope(
                db,
                scope=RollupScope(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    scope_type="project",
                    scope_id=str(project.id),
                ),
                anchor_time=computed_at,
            )
            incident_result = sync_incidents_for_scope(
                db,
                scope=regression_result.scope,
                project=project,
                regressions=regression_result.snapshots,
                detected_at=computed_at,
            )
        else:
            incident_result = IncidentSyncResult()
        telemetry_result = sync_telemetry_freshness_incident(
            db,
            project=project,
            freshness_minutes=freshness_minutes,
            detected_at=computed_at,
        )
        incident_result.opened_incidents.extend(telemetry_result.opened_incidents)
        incident_result.updated_incidents.extend(telemetry_result.updated_incidents)
        incident_result.resolved_incidents.extend(telemetry_result.resolved_incidents)
        incident_result.reopened_incidents.extend(telemetry_result.reopened_incidents)
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
        recommendation_project_ids.append(project.id)

    db.commit()
    if delivery_ids:
        enqueue_alert_delivery_jobs(delivery_ids)
    for project_id in recommendation_project_ids:
        enqueue_project_reliability_recommendations(project_id=project_id)
    enqueue_reliability_intelligence_aggregation(anchor_time=computed_at)
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
