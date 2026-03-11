from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_, select

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.trace import Trace
from app.services.trace_ingestion_control import get_effective_ingestion_policy


def run_data_retention() -> dict[str, int]:
    db = SessionLocal()
    deleted = 0
    try:
        projects = db.scalars(select(Project).where(Project.is_active.is_(True))).all()
        now = datetime.now(timezone.utc)
        for project in projects:
            policy = get_effective_ingestion_policy(db, project_id=project.id)
            success_cutoff = now - timedelta(days=policy.retention_days_success)
            error_cutoff = now - timedelta(days=policy.retention_days_error)
            result = db.execute(
                delete(Trace).where(
                    Trace.project_id == project.id,
                    or_(
                        (Trace.success.is_(True) & (Trace.created_at < success_cutoff)),
                        (Trace.success.is_(False) & (Trace.created_at < error_cutoff)),
                    ),
                )
            )
            deleted += int(result.rowcount or 0)
        db.commit()
        return {"deleted_traces": deleted}
    finally:
        db.close()
