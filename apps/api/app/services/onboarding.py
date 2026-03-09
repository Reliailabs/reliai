from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.onboarding_checklist import OnboardingChecklist


def get_or_create_checklist(db: Session, organization_id) -> OnboardingChecklist:
    checklist = (
        db.query(OnboardingChecklist)
        .filter(OnboardingChecklist.organization_id == organization_id)
        .one_or_none()
    )
    if checklist is None:
        checklist = OnboardingChecklist(organization_id=organization_id)
        db.add(checklist)
        db.flush()
    return checklist


def mark_project_created(db: Session, organization_id) -> None:
    now = datetime.now(timezone.utc)
    checklist = get_or_create_checklist(db, organization_id)
    checklist.project_created_at = checklist.project_created_at or now
    checklist.updated_at = now
    db.add(checklist)


def mark_api_key_created(db: Session, organization_id) -> None:
    now = datetime.now(timezone.utc)
    checklist = get_or_create_checklist(db, organization_id)
    checklist.api_key_created_at = checklist.api_key_created_at or now
    checklist.updated_at = now
    db.add(checklist)


def mark_trace_ingested(db: Session, organization_id) -> None:
    now = datetime.now(timezone.utc)
    checklist = get_or_create_checklist(db, organization_id)
    checklist.first_trace_ingested_at = checklist.first_trace_ingested_at or now
    checklist.updated_at = now
    db.add(checklist)
