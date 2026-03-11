from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_queue
from app.models.customer_export import CustomerExport
from app.models.deployment import Deployment
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.project import Project
from app.services.audit_log import log_action
from app.services.trace_query_router import query_recent_traces
from app.services.trace_warehouse import MAX_EVENT_WINDOW, TraceWarehouseQuery

EXPORT_STATUS_QUEUED = "queued"
EXPORT_STATUS_COMPLETED = "completed"
EXPORT_STATUS_FAILED = "failed"
EXPORT_MAX_TRACE_ROWS = 2000


def create_customer_export(
    db: Session,
    *,
    project_id: UUID,
    export_format: str,
    actor_user_id: UUID,
) -> CustomerExport:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    export = CustomerExport(
        organization_id=project.organization_id,
        project_id=project.id,
        requested_by_user_id=actor_user_id,
        export_format=export_format,
        status=EXPORT_STATUS_QUEUED,
    )
    db.add(export)
    db.flush()
    log_action(
        db,
        organization_id=project.organization_id,
        user_id=actor_user_id,
        action="customer_export_requested",
        resource_type="customer_export",
        resource_id=export.id,
        metadata={"project_id": str(project_id), "format": export_format},
    )
    db.commit()
    get_queue().enqueue("app.workers.customer_exports.run_customer_export", str(export.id))
    db.refresh(export)
    return export


def get_customer_export(db: Session, *, export_id: UUID) -> CustomerExport | None:
    return db.get(CustomerExport, export_id)


def _serialize_rows(export_format: str, payload: dict) -> tuple[str, str, str, int]:
    row_count = sum(len(value) for value in payload.values() if isinstance(value, list))
    if export_format == "json":
        return (
            f"reliai-export-{datetime.now(timezone.utc).date().isoformat()}.json",
            "application/json",
            json.dumps(payload, sort_keys=True, default=str),
            row_count,
        )
    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["dataset", "payload"])
        for dataset, items in payload.items():
            for item in items:
                writer.writerow([dataset, json.dumps(item, sort_keys=True, default=str)])
        return (
            f"reliai-export-{datetime.now(timezone.utc).date().isoformat()}.csv",
            "text/csv",
            output.getvalue(),
            row_count,
        )
    if export_format == "parquet":
        return (
            f"reliai-export-{datetime.now(timezone.utc).date().isoformat()}.parquet",
            "application/x-parquet",
            json.dumps(payload, sort_keys=True, default=str),
            row_count,
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported export format")


def run_customer_export_for_session(db: Session, *, export_id: UUID) -> CustomerExport:
    export = db.get(CustomerExport, export_id)
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found")

    project = db.get(Project, export.project_id)
    assert project is not None
    try:
        traces = _load_export_traces(project_id=project.id, organization_id=project.organization_id)
        incidents = db.scalars(
            select(Incident).where(Incident.project_id == project.id).order_by(Incident.created_at.desc())
        ).all()
        guardrails = db.execute(
            select(GuardrailPolicy.policy_type, GuardrailRuntimeEvent.action_taken, GuardrailRuntimeEvent.created_at)
            .join(GuardrailRuntimeEvent, GuardrailRuntimeEvent.policy_id == GuardrailPolicy.id)
            .where(GuardrailPolicy.project_id == project.id)
            .order_by(GuardrailRuntimeEvent.created_at.desc())
        ).all()
        deployments = db.scalars(
            select(Deployment).where(Deployment.project_id == project.id).order_by(Deployment.created_at.desc())
        ).all()

        payload = {
            "traces": [
                {
                    "trace_id": str(row.trace_id),
                    "timestamp": row.timestamp.isoformat(),
                    "environment_id": str(row.environment_id) if row.environment_id is not None else None,
                    "success": row.success,
                    "latency_ms": row.latency_ms,
                    "cost_usd": float(row.cost or 0),
                }
                for row in traces
            ],
            "incidents": [
                {
                    "incident_id": str(item.id),
                    "title": item.title,
                    "severity": item.severity,
                    "status": item.status,
                    "started_at": item.started_at.isoformat(),
                }
                for item in incidents
            ],
            "guardrails": [
                {
                    "policy_type": policy_type,
                    "action_taken": action_taken,
                    "created_at": created_at.isoformat(),
                }
                for policy_type, action_taken, created_at in guardrails
            ],
            "deployments": [
                {
                    "deployment_id": str(item.id),
                    "environment_id": str(item.environment_id),
                    "deployed_at": item.deployed_at.isoformat(),
                    "deployed_by": item.deployed_by,
                }
                for item in deployments
            ],
        }
        file_name, content_type, content_text, row_count = _serialize_rows(export.export_format, payload)
        export.status = EXPORT_STATUS_COMPLETED
        export.file_name = file_name
        export.content_type = content_type
        export.content_text = content_text
        export.row_count = row_count
        export.completed_at = datetime.now(timezone.utc)
        export.error_message = None
        if export.requested_by_user_id is not None:
            log_action(
                db,
                organization_id=export.organization_id,
                user_id=export.requested_by_user_id,
                action="customer_export_completed",
                resource_type="customer_export",
                resource_id=export.id,
                metadata={"project_id": str(export.project_id), "format": export.export_format},
            )
    except Exception as exc:
        export.status = EXPORT_STATUS_FAILED
        export.failed_at = datetime.now(timezone.utc)
        export.error_message = str(exc)
    db.add(export)
    db.commit()
    db.refresh(export)
    return export


def _load_export_traces(*, project_id: UUID, organization_id: UUID) -> list:
    now = datetime.now(timezone.utc)
    cursor = now
    rows: list = []
    while len(rows) < EXPORT_MAX_TRACE_ROWS:
        window_start = max(datetime(1970, 1, 1, tzinfo=timezone.utc), cursor - MAX_EVENT_WINDOW)
        batch = query_recent_traces(
            TraceWarehouseQuery(
                organization_id=organization_id,
                project_id=project_id,
                window_start=window_start,
                window_end=cursor,
                limit=EXPORT_MAX_TRACE_ROWS - len(rows),
            )
        )
        if not batch:
            if window_start.year == 1970 and window_start.month == 1 and window_start.day == 1:
                break
            cursor = window_start
            continue
        rows.extend(batch)
        if len(rows) >= EXPORT_MAX_TRACE_ROWS or window_start.year == 1970 and window_start.month == 1 and window_start.day == 1:
            break
        next_cursor = min(row.timestamp for row in batch)
        if next_cursor <= window_start:
            break
        cursor = next_cursor
    return rows[:EXPORT_MAX_TRACE_ROWS]
