from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.services.api_keys import create_api_key
from app.services.onboarding import get_or_create_checklist
from app.services.utils import slugify
from app.schemas.api_key import APIKeyCreate


def run() -> None:
    db = SessionLocal()
    try:
        organization = (
            db.query(Organization).filter(Organization.slug == "acme").one_or_none()
        )
        if organization is None:
            organization = Organization(name="Acme AI", slug="acme", plan="pilot")
            db.add(organization)
            db.flush()
            db.add(
                OrganizationMember(
                    organization_id=organization.id,
                    auth_user_id="seed-owner",
                    role="owner",
                )
            )
            get_or_create_checklist(db, organization.id)
            db.commit()
            db.refresh(organization)

        project = db.query(Project).filter(Project.slug == "support-agent").one_or_none()
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
        print(f"Seeded organization={organization.id}")
        print(f"Seeded project={project.id}")
        print(f"API key={plaintext}")
        print(f"Generated at={datetime.now(timezone.utc).isoformat()}")
        print(f"Key record={key_record.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
