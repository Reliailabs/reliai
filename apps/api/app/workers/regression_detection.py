from __future__ import annotations

import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.trace import Trace
from app.services.alerts import ALERT_STATUS_PENDING, create_alert_deliveries_for_open_incidents
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.workers.evaluations import enqueue_alert_delivery_job, run_trace_evaluations

logger = logging.getLogger(__name__)


def run_trace_regression_detection(trace_id: str) -> None:
    run_trace_evaluations(trace_id)

    db = SessionLocal()
    try:
        trace = db.get(Trace, UUID(trace_id))
        if trace is None:
            logger.warning("regression detection skipped because trace was not found", extra={"trace_id": trace_id})
            return
        project = db.get(Project, trace.project_id)
        if project is None:
            logger.warning("regression detection skipped because project was not found", extra={"trace_id": trace_id})
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
            opened_incidents.extend(sync_result.reopened_incidents)

        deliveries = create_alert_deliveries_for_open_incidents(db, incidents=opened_incidents)
        delivery_ids = [
            delivery.id for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING
        ]
        db.commit()
        for delivery_id in delivery_ids:
            enqueue_alert_delivery_job(delivery_id)
    finally:
        db.close()
