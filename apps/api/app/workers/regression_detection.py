from __future__ import annotations

import logging
from uuid import UUID

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.project import Project
from app.models.trace import Trace
from app.services.alerts import ALERT_STATUS_PENDING, create_alert_deliveries_for_open_incidents
from app.services.event_stream import (
    INCIDENT_CREATED_EVENT,
    RegressionDetectedEventPayload,
    publish_event,
)
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.workers.evaluations import enqueue_alert_delivery_job

logger = logging.getLogger(__name__)


def run_trace_regression_detection(trace_id: str) -> None:
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
        regression_events: list[dict] = []
        for scope in build_scopes(trace):
            result = compute_regressions_for_scope(db, scope=scope, anchor_time=trace.timestamp)
            for snapshot in result.snapshots:
                if snapshot.detected_at != trace.timestamp:
                    continue
                regression_events.append(
                    RegressionDetectedEventPayload(
                        project_id=str(trace.project_id),
                        environment_id=str(trace.environment_id) if trace.environment_id is not None else None,
                        regression_snapshot_id=str(snapshot.id),
                        trace_id=str(trace.id),
                        detected_at=snapshot.detected_at,
                        metric_name=snapshot.metric_name,
                        current_value=float(snapshot.current_value),
                        baseline_value=float(snapshot.baseline_value),
                        delta_absolute=float(snapshot.delta_absolute),
                        delta_percent=float(snapshot.delta_percent) if snapshot.delta_percent is not None else None,
                        scope_type=snapshot.scope_type,
                        scope_id=snapshot.scope_id,
                        metadata=snapshot.metadata_json or {},
                    ).model_dump(mode="json")
                )
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
        for payload in regression_events:
            publish_event(get_settings().event_stream_topic_traces, payload)
        for incident in opened_incidents:
            publish_event(
                get_settings().event_stream_topic_traces,
                {
                    "event_type": INCIDENT_CREATED_EVENT,
                    "incident_id": str(incident.id),
                    "project_id": str(incident.project_id),
                    "organization_id": str(incident.organization_id),
                    "environment_id": str(incident.environment_id) if incident.environment_id is not None else None,
                    "deployment_id": str(incident.deployment_id) if incident.deployment_id is not None else None,
                    "incident_type": incident.incident_type,
                    "severity": incident.severity,
                    "started_at": incident.started_at.isoformat(),
                    "metadata": incident.summary_json or {},
                },
            )
        for delivery_id in delivery_ids:
            enqueue_alert_delivery_job(delivery_id)
    finally:
        db.close()
