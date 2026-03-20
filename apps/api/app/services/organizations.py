from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.onboarding_checklist import OnboardingChecklist
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.schemas.organization import OrganizationCreate
from app.services.workos_roles import normalize_org_role
from app.services.stripe_billing import ensure_stripe_customer


def create_organization(db: Session, payload: OrganizationCreate) -> Organization:
    try:
        organization = Organization(
            name=payload.name,
            slug=payload.slug,
            plan="free",
        )
        db.add(organization)
        db.flush()

        db.add(
            OrganizationMember(
                organization_id=organization.id,
                user_id=UUID(payload.owner_auth_user_id),
                auth_user_id=payload.owner_auth_user_id,
                role=normalize_org_role(payload.owner_role),
            )
        )
        db.add(OnboardingChecklist(organization_id=organization.id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        ) from exc

    db.refresh(organization)
    ensure_stripe_customer(db, organization)
    return organization


def get_organization(db: Session, organization_id) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization
