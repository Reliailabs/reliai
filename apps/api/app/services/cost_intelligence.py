from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from uuid import UUID

from app.services.trace_warehouse import TraceWarehouseQuery, query_traces


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_project_cost_intelligence(*, organization_id: UUID, project_id: UUID, environment_id: UUID | None = None) -> dict:
    anchor = _utcnow()
    window_start = anchor - timedelta(days=7)
    rows = query_traces(
        TraceWarehouseQuery(
            organization_id=organization_id,
            project_id=project_id,
            environment_id=environment_id,
            window_start=window_start,
            window_end=anchor,
            limit=5000,
        )
    )
    total_cost = sum(float(row.cost or 0) for row in rows)
    cost_per_trace = round(total_cost / len(rows), 6) if rows else 0.0

    by_model: dict[str, list[float]] = defaultdict(list)
    by_day: dict[str, float] = defaultdict(float)
    for row in rows:
        model = row.model_family or "unknown"
        cost = float(row.cost or 0)
        by_model[model].append(cost)
        by_day[row.timestamp.astimezone(timezone.utc).date().isoformat()] += cost

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
                "trace_count": len(values),
                "total_cost_usd": round(sum(values), 6),
                "average_cost_usd": round(sum(values) / len(values), 6),
            }
            for model, values in sorted(by_model.items(), key=lambda item: (-sum(item[1]), item[0]))
        ],
        "cost_anomalies": anomalies,
    }
