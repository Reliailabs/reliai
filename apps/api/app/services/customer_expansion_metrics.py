from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from statistics import mean, median
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.organization_usage_expansion import OrganizationUsageExpansion
from app.models.project import Project
from app.services.trace_query_router import query_daily_metrics

EXPANSION_WINDOW_DAYS = 30
BREAKOUT_EXPANSION_RATIO = 5.0
BREAKOUT_MIN_TRACES = 100_000
EXPANSION_MIN_BASELINE_TRACES = 1_000
EXPANSION_LOOKBACK_DAYS = 3650


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day(value: datetime) -> datetime:
    utc_value = value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime(utc_value.year, utc_value.month, utc_value.day, tzinfo=timezone.utc)


def _window_sum(day_counts: Counter[date], *, start_day: date, days: int) -> int:
    return sum(int(day_counts.get(start_day + timedelta(days=offset), 0)) for offset in range(days))


def _ratio(current_volume: int, baseline_volume: int) -> float:
    if baseline_volume <= 0:
        return 1.0 if current_volume > 0 else 0.0
    return round(current_volume / baseline_volume, 1)


def _growth_rate(current_volume: int, baseline_volume: int) -> float:
    if baseline_volume <= 0:
        return 100.0 if current_volume > 0 else 0.0
    return round(((current_volume - baseline_volume) / baseline_volume) * 100, 1)


def _is_breakout(*, expansion_ratio: float, current_30_day_traces: int) -> bool:
    return expansion_ratio >= BREAKOUT_EXPANSION_RATIO and current_30_day_traces >= BREAKOUT_MIN_TRACES


def _organization_day_counts(db: Session, *, snapshot_time: datetime | None = None) -> tuple[dict[UUID, Organization], dict[UUID, Counter[date]]]:
    organizations = {
        organization.id: organization
        for organization in db.scalars(select(Organization).order_by(Organization.name.asc(), Organization.id.asc())).all()
    }
    projects = db.execute(
        select(Project.id, Project.organization_id)
        .where(Project.organization_id.in_(organizations.keys()))
        .order_by(Project.created_at.asc(), Project.id.asc())
    ).all()

    if not projects:
        return organizations, {organization_id: Counter() for organization_id in organizations}

    today_start = _start_of_day(snapshot_time or _utc_now())
    tomorrow_start = today_start + timedelta(days=1)
    earliest_rollup_start = today_start - timedelta(days=EXPANSION_LOOKBACK_DAYS)
    project_to_org = {project_id: organization_id for project_id, organization_id in projects}
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

    return organizations, counts_by_org


def _build_snapshots(db: Session, *, computed_at: datetime | None = None) -> list[dict]:
    snapshot_time = computed_at or _utc_now()
    organizations, counts_by_org = _organization_day_counts(db, snapshot_time=snapshot_time)
    current_window_start = (_start_of_day(snapshot_time) - timedelta(days=EXPANSION_WINDOW_DAYS - 1)).date()

    items = []
    for organization_id, organization in organizations.items():
        day_counts = counts_by_org.get(organization_id, Counter())
        first_day = min(day_counts) if day_counts else None
        first_volume = _window_sum(day_counts, start_day=first_day, days=EXPANSION_WINDOW_DAYS) if first_day else 0
        current_volume = _window_sum(day_counts, start_day=current_window_start, days=EXPANSION_WINDOW_DAYS)
        baseline_eligible = first_volume >= EXPANSION_MIN_BASELINE_TRACES
        expansion_ratio = _ratio(current_volume, first_volume) if baseline_eligible else 0.0
        breakout = _is_breakout(expansion_ratio=expansion_ratio, current_30_day_traces=current_volume)
        items.append(
            {
                "organization_id": organization_id,
                "organization_name": organization.name,
                "first_30_day_traces": first_volume,
                "current_30_day_traces": current_volume,
                "expansion_ratio": expansion_ratio,
                "growth_rate": _growth_rate(current_volume, first_volume) if baseline_eligible else 0.0,
                "breakout_account": breakout,
                "computed_at": snapshot_time,
            }
        )
    return items


def recompute_usage_expansion_metrics(
    db: Session,
    *,
    computed_at: datetime | None = None,
) -> list[dict]:
    snapshot_time = computed_at or _utc_now()
    items = _build_snapshots(db, computed_at=snapshot_time)
    existing_rows = {
        row.organization_id: row
        for row in db.scalars(select(OrganizationUsageExpansion)).all()
    }
    breakout_events: list[dict] = []

    for item in items:
        organization_id = item["organization_id"]
        existing = existing_rows.get(organization_id)
        if existing is None:
            existing = OrganizationUsageExpansion(organization_id=organization_id)
            db.add(existing)

        was_breakout = bool(existing.breakout_account)
        existing.first_30_day_traces = int(item["first_30_day_traces"])
        existing.current_30_day_traces = int(item["current_30_day_traces"])
        existing.expansion_ratio = float(item["expansion_ratio"])
        existing.breakout_account = bool(item["breakout_account"])
        existing.computed_at = snapshot_time

        if existing.breakout_account and not was_breakout:
            breakout_events.append(
                {
                    "organization_id": str(organization_id),
                    "expansion_ratio": float(existing.expansion_ratio),
                    "current_30_day_traces": int(existing.current_30_day_traces),
                    "first_30_day_traces": int(existing.first_30_day_traces),
                    "computed_at": snapshot_time.isoformat(),
                }
            )

    db.flush()
    return breakout_events


def _load_metric_rows(db: Session) -> list[dict]:
    rows = db.execute(
        select(OrganizationUsageExpansion, Organization.name)
        .join(Organization, Organization.id == OrganizationUsageExpansion.organization_id)
        .order_by(
            OrganizationUsageExpansion.expansion_ratio.desc(),
            OrganizationUsageExpansion.current_30_day_traces.desc(),
            Organization.name.asc(),
        )
    ).all()
    items = []
    for expansion, organization_name in rows:
        items.append(
            {
                "organization_id": str(expansion.organization_id),
                "organization_name": organization_name,
                "first_30_day_volume": expansion.first_30_day_traces,
                "current_30_day_volume": expansion.current_30_day_traces,
                "expansion_ratio": expansion.expansion_ratio,
                "growth_rate": _growth_rate(
                    expansion.current_30_day_traces,
                    expansion.first_30_day_traces,
                ),
                "breakout": expansion.breakout_account,
            }
        )
    return items


def _serialize_snapshot_rows(items: list[dict]) -> list[dict]:
    rows = [
        {
            "organization_id": str(item["organization_id"]),
            "organization_name": item["organization_name"],
            "first_30_day_volume": int(item["first_30_day_traces"]),
            "current_30_day_volume": int(item["current_30_day_traces"]),
            "expansion_ratio": float(item["expansion_ratio"]),
            "growth_rate": float(item["growth_rate"]),
            "breakout": bool(item["breakout_account"]),
        }
        for item in items
    ]
    rows.sort(
        key=lambda item: (
            item["expansion_ratio"],
            item["current_30_day_volume"],
            item["organization_name"].lower(),
        ),
        reverse=True,
    )
    return rows


def get_customer_expansion_metrics(db: Session) -> dict:
    items = _load_metric_rows(db)
    organization_count = int(db.scalar(select(func.count(Organization.id))) or 0)
    if not items or len(items) != organization_count:
        items = _serialize_snapshot_rows(_build_snapshots(db))

    baseline_total = sum(item["first_30_day_volume"] for item in items)
    current_total = sum(item["current_30_day_volume"] for item in items)
    ratios = [item["expansion_ratio"] for item in items]

    return {
        "average_expansion_ratio": round(mean(ratios), 2) if ratios else 0.0,
        "median_expansion_ratio": round(float(median(ratios)), 2) if ratios else 0.0,
        "top_expansion_ratio": round(max(ratios), 2) if ratios else 0.0,
        "total_platform_growth_pct": _growth_rate(current_total, baseline_total),
        "breakout_customers": sum(1 for item in items if item["breakout"]),
        "total_telemetry_30d": current_total,
        "organizations": items,
    }
