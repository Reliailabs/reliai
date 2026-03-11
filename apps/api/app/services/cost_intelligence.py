from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from uuid import UUID

from app.services.trace_query_router import query_hourly_metrics


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_project_cost_intelligence(*, organization_id: UUID, project_id: UUID, environment_id: UUID | None = None) -> dict:
    anchor = _utcnow()
    window_start = anchor - timedelta(days=7)
    del organization_id
    rows = query_hourly_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=window_start,
        end_time=anchor,
    )
    total_cost = sum(float(row.cost_usd or 0.0) for row in rows)
    total_traces = sum(int(row.trace_count) for row in rows)
    cost_per_trace = round(total_cost / total_traces, 6) if total_traces else 0.0

    by_model: dict[str, dict[str, float | int]] = defaultdict(lambda: {"trace_count": 0, "total_cost_usd": 0.0})
    by_day: dict[str, float] = defaultdict(float)
    for row in rows:
        model = row.model_family or "unknown"
        cost = float(row.cost_usd or 0.0)
        by_model[model]["trace_count"] += int(row.trace_count)
        by_model[model]["total_cost_usd"] += cost
        by_day[row.time_bucket.astimezone(timezone.utc).date().isoformat()] += cost

    daily_points = [
        {"date": day, "total_cost_usd": round(total, 6)}
        for day, total in sorted(by_day.items())
    ]
    values = [point["total_cost_usd"] for point in daily_points]
    baseline = mean(values) if values else 0.0
    anomalies = []
    for point in daily_points:
        if baseline <= 0:
            continue
        deviation_pct = round(((point["total_cost_usd"] - baseline) / baseline) * 100, 2)
        if deviation_pct >= 50:
            anomalies.append({**point, "deviation_pct": deviation_pct})

    return {
        "cost_per_trace": cost_per_trace,
        "daily_cost": daily_points,
        "cost_per_model": [
            {
                "model": model,
                "trace_count": int(values["trace_count"]),
                "total_cost_usd": round(float(values["total_cost_usd"]), 6),
                "average_cost_usd": round(float(values["total_cost_usd"]) / int(values["trace_count"]), 6)
                if int(values["trace_count"])
                else 0.0,
            }
            for model, values in sorted(by_model.items(), key=lambda item: (-float(item[1]["total_cost_usd"]), item[0]))
        ],
        "cost_anomalies": anomalies,
    }
