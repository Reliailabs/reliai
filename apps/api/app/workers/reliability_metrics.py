import logging
from datetime import datetime, timezone
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.models.project import Project
from app.services.alerts import ALERT_STATUS_PENDING, create_alert_deliveries_for_open_incidents
from app.services.deployments import most_recent_project_deployment
from app.services.incidents import sync_telemetry_freshness_incident
from app.services.reliability_metrics import compute_project_reliability_metrics
from app.workers.alerts import run_alert_delivery
from app.workers.deployment_risk_analysis import enqueue_deployment_risk_analysis
from app.workers.global_metrics_aggregator import enqueue_global_metrics_aggregation

logger = logging.getLogger(__name__)


def enqueue_reliability_metrics_job(
    *,
    project_id: UUID,
    prompt_version_record_id: UUID | None,
    model_version_record_id: UUID | None,
    anchor_time: datetime | None = None,
) -> None:
    queue = get_queue()
    queue.enqueue(
        run_project_reliability_metrics,
        str(project_id),
        str(prompt_version_record_id) if prompt_version_record_id is not None else None,
        str(model_version_record_id) if model_version_record_id is not None else None,
        anchor_time.isoformat() if anchor_time is not None else None,
    )


def enqueue_alert_delivery_jobs(delivery_ids: list[UUID]) -> None:
    queue = get_queue()
    for delivery_id in delivery_ids:
        queue.enqueue(run_alert_delivery, str(delivery_id))


def run_project_reliability_metrics(
    project_id: str,
    prompt_version_record_id: str | None = None,
    model_version_record_id: str | None = None,
    anchor_time: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        project = db.get(Project, UUID(project_id))
        if project is None:
            logger.warning(
                "reliability metric computation skipped because project was not found",
                extra={"project_id": project_id},
            )
            return

        computed_at = (
            datetime.fromisoformat(anchor_time).astimezone(timezone.utc)
            if anchor_time is not None
            else datetime.now(timezone.utc)
        )
        compute_project_reliability_metrics(
            db,
            project=project,
            anchor_time=computed_at,
            prompt_version_record_id=UUID(prompt_version_record_id)
            if prompt_version_record_id
            else None,
            model_version_record_id=UUID(model_version_record_id)
            if model_version_record_id
            else None,
        )
        freshness_minutes = None
        if project.last_trace_received_at is not None:
            freshness_minutes = max(
                0.0,
                (computed_at - project.last_trace_received_at.astimezone(timezone.utc)).total_seconds() / 60.0,
            )
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
        delivery_ids = [
            delivery.id for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING
        ]
        db.commit()
        if delivery_ids:
            enqueue_alert_delivery_jobs(delivery_ids)
        deployment = most_recent_project_deployment(
            db,
            project_id=project.id,
            detected_at=computed_at,
        )
        if deployment is not None:
            enqueue_deployment_risk_analysis(deployment_id=deployment.id)
        enqueue_global_metrics_aggregation(anchor_time=computed_at)
    finally:
        db.close()
