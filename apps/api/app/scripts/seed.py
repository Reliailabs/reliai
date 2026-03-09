from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.operator_user import OperatorUser
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.schemas.api_key import APIKeyCreate
from app.services.api_keys import create_api_key
from app.services.auth import create_operator_user
from app.services.onboarding import get_or_create_checklist
from app.services.utils import slugify

SEED_OPERATOR_EMAIL = "owner@acme.test"
SEED_OPERATOR_PASSWORD = "reliai-dev-password"


def run() -> None:
    db = SessionLocal()
    try:
        operator = db.scalar(select(OperatorUser).where(OperatorUser.email == SEED_OPERATOR_EMAIL))
        if operator is None:
            operator = create_operator_user(
                db,
                email=SEED_OPERATOR_EMAIL,
                password=SEED_OPERATOR_PASSWORD,
            )
            db.commit()
            db.refresh(operator)

        organization = db.scalar(select(Organization).where(Organization.slug == "acme"))
        if organization is None:
            organization = Organization(name="Acme AI", slug="acme", plan="pilot")
            db.add(organization)
            db.flush()
            db.add(
                OrganizationMember(
                    organization_id=organization.id,
                    auth_user_id=str(operator.id),
                    role="owner",
                )
            )
            get_or_create_checklist(db, organization.id)
            db.commit()
            db.refresh(organization)
        else:
            membership = db.scalar(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == organization.id,
                    OrganizationMember.auth_user_id == str(operator.id),
                )
            )
            if membership is None:
                db.add(
                    OrganizationMember(
                        organization_id=organization.id,
                        auth_user_id=str(operator.id),
                        role="owner",
                    )
                )
                db.commit()

        project = db.scalar(select(Project).where(Project.slug == "support-agent"))
        if project is None:
            project = Project(
                organization_id=organization.id,
                name="Support Agent",
                slug=slugify("Support Agent"),
                environment="prod",
                description="Seed project for local development",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        key_record, plaintext = create_api_key(db, project.id, APIKeyCreate(label="Local ingest"))
        print(f"Seeded operator_email={SEED_OPERATOR_EMAIL}")
        print(f"Seeded operator_password={SEED_OPERATOR_PASSWORD}")
        print(f"Seeded organization={organization.id}")
        print(f"Seeded project={project.id}")
        print(f"API key={plaintext}")
        print(f"Generated at={datetime.now(timezone.utc).isoformat()}")
        print(f"Key record={key_record.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
