import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.trace import Trace
from app.services.incidents import sync_incidents_for_scope
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes

logger = logging.getLogger(__name__)


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

        for scope in build_scopes(trace):
            result = compute_regressions_for_scope(db, scope=scope, anchor_time=trace.timestamp)
            sync_incidents_for_scope(
                db,
                scope=scope,
                project=project,
                regressions=result.snapshots,
                detected_at=trace.timestamp,
            )
        db.commit()
    finally:
        db.close()
