from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.db.session import get_redis
from app.models.organization import Organization
from app.services.plans import normalize_plan
from app.services.rate_limiter import get_monthly_usage, increment_monthly_usage

logger = logging.getLogger(__name__)


def _current_month_label(now: datetime | None = None) -> str:
    anchor = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    return anchor.strftime("%Y-%m")


def monthly_usage_key(organization_id: str, month_label: str) -> str:
    return f"usage:monthly_traces:{organization_id}:{month_label}"


def record_monthly_trace_usage(*, organization_id: str, amount: int = 1) -> int:
    month_label = _current_month_label()
    key = monthly_usage_key(organization_id, month_label)
    return increment_monthly_usage(key=key, amount=amount)


def _usage_price_map() -> dict[str, str]:
    settings = get_settings()
    mapping = {
        "team": settings.stripe_price_team_usage,
        "production": settings.stripe_price_production_usage,
    }
    return {key: value for key, value in mapping.items() if value}


def sync_monthly_usage(db: Session) -> None:
    month_label = _current_month_label()
    redis = get_redis()
    for organization in db.scalars(select(Organization)).all():
        if organization.monthly_usage_month != month_label:
            organization.monthly_usage_month = month_label
            organization.monthly_traces = 0
            organization.monthly_traces_reported = 0
        key = monthly_usage_key(str(organization.id), month_label)
        try:
            value = redis.get(key)
            monthly_traces = int(value) if value is not None else 0
        except Exception:
            monthly_traces = get_monthly_usage(key=key)
        organization.monthly_traces = max(organization.monthly_traces, monthly_traces)
        db.add(organization)
    db.commit()


def report_usage_to_stripe(db: Session) -> int:
    settings = get_settings()
    if not settings.stripe_secret_key:
        return 0
    usage_price_map = _usage_price_map()
    if not usage_price_map:
        return 0
    stripe.api_key = settings.stripe_secret_key
    month_label = _current_month_label()
    total_reported = 0

    organizations = db.scalars(
        select(Organization).where(Organization.stripe_subscription_id.is_not(None))
    ).all()
    for organization in organizations:
        plan = normalize_plan(organization.plan)
        usage_price_id = usage_price_map.get(plan)
        if not usage_price_id:
            continue
        if organization.monthly_usage_month != month_label:
            organization.monthly_usage_month = month_label
            organization.monthly_traces = 0
            organization.monthly_traces_reported = 0
        key = monthly_usage_key(str(organization.id), month_label)
        monthly_traces = get_monthly_usage(key=key)
        delta = monthly_traces - organization.monthly_traces_reported
        if delta <= 0:
            continue
        try:
            subscription = stripe.Subscription.retrieve(organization.stripe_subscription_id)
            usage_item_id = None
            for item in subscription["items"]["data"]:
                if item.get("price", {}).get("id") == usage_price_id:
                    usage_item_id = item["id"]
                    break
            if not usage_item_id:
                logger.warning("Stripe usage price not found for org %s", organization.id)
                continue
            stripe.UsageRecord.create(
                subscription_item=usage_item_id,
                quantity=delta,
                timestamp=int(time.time()),
                action="increment",
            )
            organization.monthly_traces_reported += delta
            organization.monthly_traces = max(organization.monthly_traces, monthly_traces)
            db.add(organization)
            db.commit()
            total_reported += delta
        except Exception:
            logger.exception("Failed to report Stripe usage for org %s", organization.id)
            db.rollback()
    return total_reported
