import logging
from uuid import UUID

from app.db.session import SessionLocal, get_queue
from app.models.project import Project
from app.models.trace import Trace
from app.services.alerts import (
    ALERT_STATUS_PENDING,
    create_alert_deliveries_for_open_incidents,
    mark_delivery_enqueue_failed,
)
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.workers.alerts import run_alert_delivery

logger = logging.getLogger(__name__)


def enqueue_alert_delivery_job(delivery_id: UUID) -> None:
    try:
        get_queue().enqueue(run_alert_delivery, str(delivery_id))
    except Exception as exc:
        logger.exception("failed to enqueue alert delivery", extra={"delivery_id": str(delivery_id)})
        follow_up_session = SessionLocal()
        try:
            mark_delivery_enqueue_failed(follow_up_session, delivery_id, str(exc))
        finally:
            follow_up_session.close()


def run_trace_evaluations(trace_id: str) -> None:
    db = SessionLocal()
    try:
        evaluation = run_structured_output_validity_evaluation(db, UUID(trace_id))
        if evaluation is None:
            logger.warning("trace evaluation skipped because trace was not found", extra={"trace_id": trace_id})
            return

        trace = db.get(Trace, UUID(trace_id))
        if trace is None:
            logger.warning("signal computation skipped because trace was not found", extra={"trace_id": trace_id})
            return
        project = db.get(Project, trace.project_id)
        if project is None:
            logger.warning("signal computation skipped because project was not found", extra={"trace_id": trace_id})
            return

        opened_incidents = []
        for scope in build_scopes(trace):
            result = compute_regressions_for_scope(db, scope=scope, anchor_time=trace.timestamp)
            sync_result = sync_incidents_for_scope(
                db,
                scope=scope,
                project=project,
                regressions=result.snapshots,
                detected_at=trace.timestamp,
            )
            opened_incidents.extend(sync_result.opened_incidents)

        deliveries = create_alert_deliveries_for_open_incidents(db, incidents=opened_incidents)
        delivery_ids = [
            delivery.id for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING
        ]
        db.commit()
        for delivery_id in delivery_ids:
            enqueue_alert_delivery_job(delivery_id)
    finally:
        db.close()
