from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.incident import Incident
from app.models.regression_snapshot import RegressionSnapshot
from app.models.reliability_metric import ReliabilityMetric
from app.models.trace import Trace
from app.services.registry import build_model_version_path, get_model_version_record


def get_model_version_detail(db: Session, *, project_id, model_version_id) -> dict | None:
    record = get_model_version_record(db, project_id=project_id, model_version_id=model_version_id)
    if record is None:
        return None

    trace_count = int(
        db.scalar(
            select(func.count())
            .select_from(Trace)
            .where(Trace.project_id == project_id, Trace.model_version_record_id == record.id)
        )
        or 0
    )
    traces = (
        db.scalars(
            select(Trace)
            .options(
                selectinload(Trace.retrieval_span),
                selectinload(Trace.evaluations),
                selectinload(Trace.prompt_version_record),
                selectinload(Trace.model_version_record),
            )
            .where(Trace.project_id == project_id, Trace.model_version_record_id == record.id)
            .order_by(desc(Trace.created_at), desc(Trace.id))
            .limit(8)
        )
        .unique()
        .all()
    )
    candidate_regressions = db.scalars(
        select(RegressionSnapshot)
        .where(RegressionSnapshot.project_id == project_id)
        .order_by(desc(RegressionSnapshot.detected_at))
        .limit(50)
    ).all()
    regressions = [
        regression
        for regression in candidate_regressions
        if (regression.metadata_json or {}).get("top_model_version_id") == str(record.id)
    ][:8]
    candidate_incidents = db.scalars(
        select(Incident)
        .options(selectinload(Incident.project))
        .where(Incident.project_id == project_id)
        .order_by(desc(Incident.started_at))
        .limit(50)
    ).all()
    incidents = [
        incident
        for incident in candidate_incidents
        if (incident.summary_json or {}).get("top_model_version_id") == str(record.id)
    ][:8]
    metrics = db.scalars(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == project_id,
            ReliabilityMetric.scope_type == "model_version",
            ReliabilityMetric.scope_id == str(record.id),
        )
        .order_by(desc(ReliabilityMetric.window_end))
        .limit(12)
    ).all()
    return {
        "record": record,
        "trace_count": trace_count,
        "recent_traces": traces,
        "recent_regressions": regressions,
        "related_incidents": incidents,
        "recent_reliability_metrics": metrics,
        "traces_path": build_model_version_path(project_id=project_id, model_version_id=record.id),
        "regressions_path": f"/projects/{project_id}/regressions",
        "incidents_path": f"/incidents?project_id={project_id}",
    }
