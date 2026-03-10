from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.project import Project
from app.services.trace_warehouse import query_all_traces

USAGE_TIER_UNDER_1M = 1_000_000
USAGE_TIER_1M_10M = 10_000_000
USAGE_TIER_10M_100M = 100_000_000
USAGE_WINDOW_DAYS = 30
TREND_WINDOW_DAYS = 7


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


def get_growth_metrics(db: Session) -> dict:
    now = _utc_now()
    today_start = _start_of_day(now)
    tomorrow_start = today_start + timedelta(days=1)
    prior_week_start = today_start - timedelta(days=TREND_WINDOW_DAYS)
    chart_start = today_start - timedelta(days=TREND_WINDOW_DAYS - 1)
    usage_start = today_start - timedelta(days=USAGE_WINDOW_DAYS - 1)

    trace_rows = query_all_traces(window_start=prior_week_start, window_end=tomorrow_start)
    trace_counts_by_day: Counter[str] = Counter()
    for row in trace_rows:
        trace_counts_by_day[_as_utc(row.timestamp).date().isoformat()] += 1

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

    usage_rows = query_all_traces(window_start=usage_start, window_end=tomorrow_start)
    trace_count_by_project = Counter(str(row.project_id) for row in usage_rows)
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
    }
