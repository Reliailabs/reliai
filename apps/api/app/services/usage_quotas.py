from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.usage_quota import UsageQuota
from app.services.rate_limiter import day_bucket_key, increment_daily_usage


def get_or_create_usage_quota(db: Session, *, organization_id: UUID) -> UsageQuota:
    quota = db.query(UsageQuota).filter(UsageQuota.organization_id == organization_id).one_or_none()
    if quota is not None:
        return quota
    if db.get(Organization, organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    quota = UsageQuota(organization_id=organization_id)
    db.add(quota)
    db.flush()
    db.commit()
    db.refresh(quota)
    return quota


def enforce_daily_trace_quota(db: Session, *, organization_id: UUID) -> int:
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    key = day_bucket_key(prefix="quota:traces", identifier=str(organization_id))
    value = increment_daily_usage(key=key)
    if quota.max_traces_per_day is not None and value > quota.max_traces_per_day:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Trace quota exceeded")
    return value


def enforce_daily_api_quota(db: Session, *, organization_id: UUID) -> int:
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    key = day_bucket_key(prefix="quota:api", identifier=str(organization_id))
    value = increment_daily_usage(key=key)
    if quota.max_api_requests is not None and value > quota.max_api_requests:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="API request quota exceeded")
    return value


def enforce_processor_quota(db: Session, *, organization_id: UUID, current_count: int) -> None:
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    if quota.max_processors is not None and current_count >= quota.max_processors:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Processor quota exceeded")
