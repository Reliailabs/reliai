from sqlalchemy import select

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_organization_membership
from app.services.environments import ensure_project_bootstrap_environments, normalize_environment_name
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
        environment=normalize_environment_name(payload.environment),
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
    ensure_project_bootstrap_environments(db, project=project)
    db.commit()
    db.refresh(project)
    return project


def get_project(db: Session, project_id) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project.environment = normalize_environment_name(project.environment)
    return project


def list_projects(db: Session, operator: OperatorContext, query: ProjectListQuery) -> list[Project]:
    if query.organization_id is not None:
        require_organization_membership(operator, query.organization_id)

    statement = select(Project).where(Project.organization_id.in_(operator.organization_ids))
    if query.organization_id is not None:
        statement = statement.where(Project.organization_id == query.organization_id)
    statement = statement.order_by(Project.name).limit(query.limit)
    projects = db.scalars(statement).all()
    for project in projects:
        project.environment = normalize_environment_name(project.environment)
    return projects
