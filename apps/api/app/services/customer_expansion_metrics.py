from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from statistics import mean
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.project import Project
from app.services.trace_query_router import query_daily_metrics

EXPANSION_WINDOW_DAYS = 30
BREAKOUT_EXPANSION_RATIO = 5.0
EXPANSION_LOOKBACK_DAYS = 3650


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day(value: datetime) -> datetime:
    utc_value = value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime(utc_value.year, utc_value.month, utc_value.day, tzinfo=timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _window_sum(day_counts: Counter[date], *, start_day: date, days: int) -> int:
    return sum(int(day_counts.get(start_day + timedelta(days=offset), 0)) for offset in range(days))


def _ratio(current_volume: int, baseline_volume: int) -> float:
    if baseline_volume <= 0:
        return float(current_volume > 0)
    return round(current_volume / baseline_volume, 2)


def _growth_rate(current_volume: int, baseline_volume: int) -> float:
    if baseline_volume <= 0:
        return 100.0 if current_volume > 0 else 0.0
    return round(((current_volume - baseline_volume) / baseline_volume) * 100, 1)


def _organization_day_counts(db: Session) -> tuple[dict[UUID, Organization], dict[UUID, list[Project]], dict[UUID, Counter[date]]]:
    organizations = {
        organization.id: organization
        for organization in db.scalars(select(Organization).order_by(Organization.name.asc(), Organization.id.asc())).all()
    }
    projects = db.scalars(
        select(Project)
        .where(Project.organization_id.in_(organizations.keys()))
        .order_by(Project.created_at.asc(), Project.id.asc())
    ).all()
    projects_by_org: dict[UUID, list[Project]] = {organization_id: [] for organization_id in organizations}
    for project in projects:
        projects_by_org.setdefault(project.organization_id, []).append(project)

    if not projects:
        return organizations, projects_by_org, {organization_id: Counter() for organization_id in organizations}

    today_start = _start_of_day(_utc_now())
    tomorrow_start = today_start + timedelta(days=1)
    earliest_rollup_start = today_start - timedelta(days=EXPANSION_LOOKBACK_DAYS)
    project_to_org = {project.id: project.organization_id for project in projects}
    counts_by_org: dict[UUID, Counter[date]] = {organization_id: Counter() for organization_id in organizations}

    for row in query_daily_metrics(
        project_id=None,
        environment_id=None,
        start_time=earliest_rollup_start,
        end_time=tomorrow_start,
    ):
        project_org_id = project_to_org.get(row.project_id)
        if project_org_id is None:
            continue
        counts_by_org[project_org_id][row.time_bucket.date()] += int(row.trace_count)

    return organizations, projects_by_org, counts_by_org


def compute_expansion_ratio(db: Session, org_id: UUID) -> dict:
    organizations, projects_by_org, counts_by_org = _organization_day_counts(db)
    organization = organizations.get(org_id)
    if organization is None:
        raise ValueError("Organization not found")
    projects = projects_by_org.get(org_id, [])
    if not projects:
        return {
            "organization_id": str(org_id),
            "organization_name": organization.name,
            "first_30_day_volume": 0,
            "current_30_day_volume": 0,
            "expansion_ratio": 0.0,
            "growth_rate": 0.0,
            "breakout": False,
        }

    today_start = _start_of_day(_utc_now())
    tomorrow_start = today_start + timedelta(days=1)
    current_window_start = (today_start - timedelta(days=EXPANSION_WINDOW_DAYS - 1)).date()
    del tomorrow_start
    day_counts = counts_by_org.get(org_id, Counter())
    first_day = min(day_counts) if day_counts else None
    first_volume = _window_sum(day_counts, start_day=first_day, days=EXPANSION_WINDOW_DAYS) if first_day else 0
    current_volume = _window_sum(day_counts, start_day=current_window_start, days=EXPANSION_WINDOW_DAYS)
    expansion_ratio = _ratio(current_volume, first_volume)

    return {
        "organization_id": str(org_id),
        "organization_name": organization.name,
        "first_30_day_volume": first_volume,
        "current_30_day_volume": current_volume,
        "expansion_ratio": expansion_ratio,
        "growth_rate": _growth_rate(current_volume, first_volume),
        "breakout": expansion_ratio > BREAKOUT_EXPANSION_RATIO,
    }


def get_customer_expansion_metrics(db: Session) -> dict:
    organizations, projects_by_org, counts_by_org = _organization_day_counts(db)
    today_start = _start_of_day(_utc_now())
    current_window_start = (today_start - timedelta(days=EXPANSION_WINDOW_DAYS - 1)).date()

    items = []
    for organization_id, organization in organizations.items():
        projects = projects_by_org.get(organization_id, [])
        if not projects:
            items.append(
                {
                    "organization_id": str(organization_id),
                    "organization_name": organization.name,
                    "first_30_day_volume": 0,
                    "current_30_day_volume": 0,
                    "expansion_ratio": 0.0,
                    "growth_rate": 0.0,
                    "breakout": False,
                }
            )
            continue

        day_counts = counts_by_org.get(organization_id, Counter())
        first_day = min(day_counts) if day_counts else None
        first_volume = _window_sum(day_counts, start_day=first_day, days=EXPANSION_WINDOW_DAYS) if first_day else 0
        current_volume = _window_sum(day_counts, start_day=current_window_start, days=EXPANSION_WINDOW_DAYS)
        expansion_ratio = _ratio(current_volume, first_volume)
        items.append(
            {
                "organization_id": str(organization_id),
                "organization_name": organization.name,
                "first_30_day_volume": first_volume,
                "current_30_day_volume": current_volume,
                "expansion_ratio": expansion_ratio,
                "growth_rate": _growth_rate(current_volume, first_volume),
                "breakout": expansion_ratio > BREAKOUT_EXPANSION_RATIO,
            }
        )
    items.sort(
        key=lambda item: (
            item["expansion_ratio"],
            item["current_30_day_volume"],
            item["organization_name"].lower(),
        ),
        reverse=True,
    )

    baseline_total = sum(item["first_30_day_volume"] for item in items)
    current_total = sum(item["current_30_day_volume"] for item in items)

    return {
        "average_expansion_ratio": round(mean([item["expansion_ratio"] for item in items]), 2) if items else 0.0,
        "total_platform_growth_pct": _growth_rate(current_total, baseline_total),
        "breakout_customers": sum(1 for item in items if item["breakout"]),
        "organizations": items,
    }
