from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.usage_quota import UsageQuota
from app.services.plans import normalize_plan
from datetime import datetime
from calendar import monthrange

from app.core.settings import get_settings
from app.services.rate_limiter import day_bucket_key, get_daily_usage, get_monthly_usage, increment_daily_usage
from app.services.stripe_usage import monthly_usage_key, record_monthly_trace_usage

INCLUDED_MONTHLY_TRACES = {
    "team": 5_000_000,
    "production": 20_000_000,
}


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
    record_monthly_trace_usage(organization_id=str(organization_id))
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


def get_usage_status(db: Session, *, organization_id: UUID) -> dict[str, object]:
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    organization = db.get(Organization, organization_id)
    month_label = datetime.utcnow().strftime("%Y-%m")
    redis_key = monthly_usage_key(str(organization_id), month_label)
    redis_used = get_monthly_usage(key=redis_key)
    used = max(int(organization.monthly_traces) if organization is not None else 0, redis_used)
    plan_limit = None
    if organization is not None:
        plan_limit = INCLUDED_MONTHLY_TRACES.get(normalize_plan(organization.plan))
    limit = quota.max_traces_per_day * 30 if quota.max_traces_per_day else plan_limit
    if plan_limit is not None and limit is not None:
        limit = min(plan_limit, limit)
    percent_used = 0.0
    status_label = "normal"
    today = datetime.utcnow()
    daily_key = day_bucket_key(prefix="quota:traces", identifier=str(organization_id))
    daily_used = get_daily_usage(key=daily_key)
    days_in_month = monthrange(today.year, today.month)[1]
    remaining_days = max(days_in_month - today.day, 0)
    projected_usage = used + int(daily_used * remaining_days)
    estimated_overage_cost = None
    if limit:
        percent_used = used / limit
        if percent_used >= 1.0:
            status_label = "blocked"
        elif percent_used >= 0.9:
            status_label = "critical"
        elif percent_used >= 0.7:
            status_label = "warning"
        if projected_usage > limit:
            settings = get_settings()
            plan = (organization.plan if organization is not None else "free").strip().lower()
            if plan == "production":
                unit_cost = settings.stripe_usage_cost_per_million_production
            else:
                unit_cost = settings.stripe_usage_cost_per_million_team
            estimated_overage = max(projected_usage - limit, 0)
            estimated_overage_cost = round((estimated_overage / 1_000_000) * unit_cost, 2)
    return {
        "used": used,
        "limit": limit,
        "percent_used": round(percent_used, 3),
        "usage_percent": round(percent_used, 3),
        "projected_usage": projected_usage,
        "estimated_overage_cost": estimated_overage_cost,
        "status": status_label,
    }
