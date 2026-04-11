from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation
from app.models.project import Project
from app.services.usage_quotas import get_or_create_usage_quota


def _utc_day_start(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def get_organization_evaluation_usage(
    db: Session,
    *,
    organization_id: UUID,
    window_days: int,
) -> dict[str, object]:
    if window_days < 1:
        raise ValueError("window_days must be >= 1")

    now = datetime.now(timezone.utc)
    today_start = _utc_day_start(now)
    window_start = today_start - timedelta(days=window_days - 1)

    date_bucket = func.date_trunc("day", func.timezone("UTC", Evaluation.created_at))
    stmt = (
        select(date_bucket.label("day"), func.count().label("count"))
        .select_from(Evaluation)
        .join(Project, Project.id == Evaluation.project_id)
        .where(Project.organization_id == organization_id)
        .where(Evaluation.created_at >= window_start)
        .group_by("day")
        .order_by("day")
    )

    rows = db.execute(stmt).all()
    counts_by_day = {
        (row.day.date().isoformat() if row.day is not None else None): int(row.count)
        for row in rows
        if row.day is not None
    }

    daily = []
    total = 0
    for offset in range(window_days):
        day = (window_start + timedelta(days=offset)).date().isoformat()
        count = counts_by_day.get(day, 0)
        total += count
        daily.append({"date": day, "count": count})

    used_today = counts_by_day.get(today_start.date().isoformat(), 0)
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    limit = quota.max_api_requests
    percent_used = None
    if limit:
        percent_used = round(used_today / limit, 3)

    return {
        "window_days": window_days,
        "total": total,
        "used_today": used_today,
        "limit": limit,
        "percent_used": percent_used,
        "daily": daily,
    }
