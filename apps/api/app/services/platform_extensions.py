from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.external_processor import ExternalProcessor
from app.models.platform_extension import PlatformExtension
from app.models.project import Project
from app.schemas.platform_extension import PlatformExtensionCreate
from app.schemas.external_processor import ExternalProcessorCreate
from app.services.audit_log import log_action
from app.services.external_processors import create_external_processor
from app.services.usage_quotas import enforce_processor_quota


def list_platform_extensions(db: Session, *, organization_id: UUID) -> list[PlatformExtension]:
    return list(
        db.scalars(
            select(PlatformExtension)
            .where(PlatformExtension.organization_id == organization_id)
            .order_by(PlatformExtension.created_at.desc(), PlatformExtension.name.asc())
        ).all()
    )


def create_platform_extension(
    db: Session,
    *,
    payload: PlatformExtensionCreate,
    actor_user_id: UUID,
) -> PlatformExtension:
    project = db.get(Project, payload.project_id)
    if project is None or project.organization_id != payload.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not belong to organization")
    current_count = int(
        db.scalar(
            select(func.count(PlatformExtension.id)).where(
                PlatformExtension.organization_id == payload.organization_id
            )
        )
        or 0
    )
    enforce_processor_quota(db, organization_id=payload.organization_id, current_count=current_count)
    processor = create_external_processor(
        db,
        project=project,
        payload=ExternalProcessorCreate(
            name=payload.name,
            event_type=payload.event_type,
            endpoint_url=payload.endpoint_url,
            secret=payload.secret,
            enabled=payload.enabled,
        ),
        actor_user_id=actor_user_id,
    )
    extension = PlatformExtension(
        organization_id=payload.organization_id,
        project_id=payload.project_id,
        processor_id=processor.id,
        name=payload.name.strip(),
    )
    db.add(extension)
    db.flush()
    log_action(
        db,
        organization_id=payload.organization_id,
        user_id=actor_user_id,
        action="platform_extension_created",
        resource_type="platform_extension",
        resource_id=extension.id,
        metadata={"project_id": str(payload.project_id), "processor_id": str(processor.id)},
    )
    db.commit()
    db.refresh(extension)
    return extension
