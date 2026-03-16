from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.organization import Organization
from app.models.project import Project
from app.services.customer_expansion_metrics import EXPANSION_MIN_BASELINE_TRACES, get_customer_expansion_metrics
from app.services.trace_query_router import query_daily_metrics

USAGE_TIER_UNDER_1M = 1_000_000
USAGE_TIER_1M_10M = 10_000_000
USAGE_TIER_10M_100M = 100_000_000
USAGE_WINDOW_DAYS = 30
TREND_WINDOW_DAYS = 7
COHORT_MONTHS = 12
USAGE_DISTRIBUTION_LIMIT = 50


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day(value: datetime) -> datetime:
    utc_value = _as_utc(value)
    return datetime(utc_value.year, utc_value.month, utc_value.day, tzinfo=timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _daily_points(counter: Counter[str], *, start_day: datetime, days: int) -> list[dict[str, int | str]]:
    return [
        {
            "date": (start_day + timedelta(days=offset)).date().isoformat(),
            "count": int(counter.get((start_day + timedelta(days=offset)).date().isoformat(), 0)),
        }
        for offset in range(days)
    ]


def _growth_pct(today: int, baseline_average: float) -> int:
    if baseline_average <= 0:
        return 100 if today > 0 else 0
    return int(round(((today - baseline_average) / baseline_average) * 100))


def _bucket_usage(count: int) -> str:
    if count < USAGE_TIER_UNDER_1M:
        return "under_1m"
    if count < USAGE_TIER_1M_10M:
        return "1m_10m"
    if count < USAGE_TIER_10M_100M:
        return "10m_100m"
    return "100m_plus"


def _month_start(value: datetime) -> datetime:
    utc_value = _as_utc(value)
    return datetime(utc_value.year, utc_value.month, 1, tzinfo=timezone.utc)


def _shift_months(value: datetime, months: int) -> datetime:
    month_index = (value.year * 12 + (value.month - 1)) + months
    year = month_index // 12
    month = (month_index % 12) + 1
    return datetime(year, month, 1, tzinfo=timezone.utc)


def _month_delta(start: datetime, end: datetime) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


def get_growth_metrics(db: Session) -> dict:
    now = _utc_now()
    today_start = _start_of_day(now)
    tomorrow_start = today_start + timedelta(days=1)
    prior_week_start = today_start - timedelta(days=TREND_WINDOW_DAYS)
    chart_start = today_start - timedelta(days=TREND_WINDOW_DAYS - 1)
    usage_start = today_start - timedelta(days=USAGE_WINDOW_DAYS - 1)
    cohort_start = _shift_months(_month_start(today_start), -COHORT_MONTHS)

    project_rows = db.execute(select(Project.id, Project.organization_id).order_by(Project.created_at.asc(), Project.id.asc())).all()
    project_to_org = {project_id: organization_id for project_id, organization_id in project_rows}
    organization_names = {
        organization_id: name
        for organization_id, name in db.execute(select(Organization.id, Organization.name)).all()
    }

    trace_rollups = query_daily_metrics(
        project_id=None,
        environment_id=None,
        start_time=prior_week_start,
        end_time=tomorrow_start,
    )
    trace_counts_by_day: Counter[str] = Counter()
    for row in trace_rollups:
        trace_counts_by_day[row.time_bucket.date().isoformat()] += int(row.trace_count)

    today_count = int(trace_counts_by_day.get(today_start.date().isoformat(), 0))
    seven_day_avg = sum(
        trace_counts_by_day.get((prior_week_start + timedelta(days=offset)).date().isoformat(), 0)
        for offset in range(TREND_WINDOW_DAYS)
    ) / TREND_WINDOW_DAYS

    incident_start = today_start - timedelta(days=TREND_WINDOW_DAYS - 1)
    recent_incidents = db.scalars(
        select(Incident)
        .where(Incident.started_at >= incident_start, Incident.started_at < tomorrow_start)
        .order_by(Incident.started_at.asc(), Incident.id.asc())
    ).all()
    incident_counts_by_day: Counter[str] = Counter()
    mttr_values: list[float] = []
    for incident in recent_incidents:
        incident_day = _as_utc(incident.started_at).date().isoformat()
        incident_counts_by_day[incident_day] += 1
        if incident.resolved_at is not None:
            mttr_values.append(
                max(
                    0.0,
                    (
                        _as_utc(incident.resolved_at)
                        - _as_utc(incident.started_at)
                    ).total_seconds()
                    / 60.0,
                )
            )

    guardrail_action_counts = defaultdict(int)
    for action, count in db.execute(
        select(
            GuardrailRuntimeEvent.action_taken,
            func.count(GuardrailRuntimeEvent.id),
        )
        .where(
            GuardrailRuntimeEvent.created_at >= incident_start,
            GuardrailRuntimeEvent.created_at < tomorrow_start,
        )
        .group_by(GuardrailRuntimeEvent.action_taken)
    ).all():
        guardrail_action_counts[action] = int(count)

    usage_rollups = query_daily_metrics(
        project_id=None,
        environment_id=None,
        start_time=usage_start,
        end_time=tomorrow_start,
    )
    trace_count_by_project: Counter[str] = Counter()
    for row in usage_rollups:
        if row.project_id is None:
            continue
        trace_count_by_project[str(row.project_id)] += int(row.trace_count)
    active_project_ids = [
        str(project_id)
        for project_id in db.scalars(select(Project.id).where(Project.is_active.is_(True))).all()
    ]
    usage_tiers = {
        "under_1m": 0,
        "1m_10m": 0,
        "10m_100m": 0,
        "100m_plus": 0,
    }
    for project_id in active_project_ids:
        usage_tiers[_bucket_usage(int(trace_count_by_project.get(project_id, 0)))] += 1

    cohort_rollups = query_daily_metrics(
        project_id=None,
        environment_id=None,
        start_time=cohort_start,
        end_time=tomorrow_start,
    )
    monthly_usage_by_org: dict[str, Counter[datetime]] = defaultdict(Counter)
    usage_30d_by_org: Counter[str] = Counter()
    for row in cohort_rollups:
        if row.project_id is None:
            continue
        organization_id = project_to_org.get(row.project_id)
        if organization_id is None:
            continue
        month_bucket = _month_start(row.time_bucket)
        monthly_usage_by_org[str(organization_id)][month_bucket] += int(row.trace_count)
        if row.time_bucket >= usage_start:
            usage_30d_by_org[str(organization_id)] += int(row.trace_count)

    cohort_buckets: dict[int, list[float]] = defaultdict(list)
    cohort_counts: dict[int, int] = defaultdict(int)
    for organization_id, month_counts in monthly_usage_by_org.items():
        if not month_counts:
            continue
        first_month = min(month_counts)
        baseline = int(month_counts[first_month])
        if baseline < EXPANSION_MIN_BASELINE_TRACES:
            continue
        for month_bucket, monthly_traces in month_counts.items():
            month_index = _month_delta(first_month, month_bucket)
            if month_index < 0 or month_index > COHORT_MONTHS:
                continue
            cohort_buckets[month_index].append(round(float(monthly_traces) / float(baseline), 2))
            cohort_counts[month_index] += 1

    usage_expansion_cohort = [
        {
            "month_index": month_index,
            "usage_index": round(sum(cohort_buckets.get(month_index, [])) / len(cohort_buckets[month_index]), 2)
            if cohort_buckets.get(month_index)
            else 0.0,
            "organizations": cohort_counts.get(month_index, 0),
        }
        for month_index in range(COHORT_MONTHS + 1)
    ]

    customer_usage_distribution = [
        {
            "rank": rank,
            "organization_id": organization_id,
            "organization_name": organization_names.get(UUID(organization_id), organization_id),
            "traces_30d": traces_30d,
        }
        for rank, (organization_id, traces_30d) in enumerate(
            sorted(
                usage_30d_by_org.items(),
                key=lambda item: (-item[1], organization_names.get(UUID(item[0]), item[0]).lower()),
            )[:USAGE_DISTRIBUTION_LIMIT],
            start=1,
        )
    ]

    expansion_metrics = get_customer_expansion_metrics(db)

    return {
        "trace_volume": {
            "today": today_count,
            "seven_day_avg": int(round(seven_day_avg)),
            "growth_pct": _growth_pct(today_count, seven_day_avg),
            "daily_points": _daily_points(trace_counts_by_day, start_day=chart_start, days=TREND_WINDOW_DAYS),
        },
        "incident_metrics": {
            "incidents_detected": len(recent_incidents),
            "avg_mttr_minutes": int(round(sum(mttr_values) / len(mttr_values))) if mttr_values else 0,
            "daily_points": _daily_points(incident_counts_by_day, start_day=incident_start, days=TREND_WINDOW_DAYS),
        },
        "guardrail_metrics": {
            "retries": int(guardrail_action_counts.get("retry", 0)),
            "fallbacks": int(guardrail_action_counts.get("fallback_model", 0)),
            "blocks": int(guardrail_action_counts.get("block", 0)),
        },
        "usage_tiers": usage_tiers,
        "expansion_metrics": {
            "median_expansion_ratio": expansion_metrics["median_expansion_ratio"],
            "top_expansion_ratio": expansion_metrics["top_expansion_ratio"],
            "breakout_accounts_detected": expansion_metrics["breakout_customers"],
            "total_telemetry_30d": expansion_metrics["total_telemetry_30d"],
        },
        "usage_expansion_cohort": usage_expansion_cohort,
        "customer_usage_distribution": customer_usage_distribution,
    }
