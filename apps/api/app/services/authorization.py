from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.trace import Trace
from app.services.auth import OperatorContext


def require_organization_membership(operator: OperatorContext, organization_id: UUID) -> None:
    if organization_id not in operator.organization_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def require_project_access(db: Session, operator: OperatorContext, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    require_organization_membership(operator, project.organization_id)
    return project


def require_trace_access(db: Session, operator: OperatorContext, trace_id: UUID) -> Trace:
    trace = db.scalar(select(Trace).where(Trace.id == trace_id))
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    require_organization_membership(operator, trace.organization_id)
    return trace
