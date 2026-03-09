from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.project import Project
from app.schemas.project import ProjectCreate
from app.services.onboarding import mark_project_created
from app.services.utils import slugify


def create_project(db: Session, organization_id, payload: ProjectCreate) -> Project:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )

    project = Project(
        organization_id=organization.id,
        name=payload.name,
        slug=payload.slug or slugify(payload.name),
        environment=payload.environment,
        description=payload.description,
    )
    db.add(project)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project slug already exists for this organization",
        ) from exc

    mark_project_created(db, organization.id)
    db.commit()
    db.refresh(project)
    return project


def get_project(db: Session, project_id) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
