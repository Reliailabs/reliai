from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation
from app.models.global_model_reliability import GlobalModelReliability
from app.models.trace import Trace
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE

METRIC_SUCCESS_RATE = "success_rate"
METRIC_AVERAGE_LATENCY_MS = "average_latency_ms"
METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE = "structured_output_validity_rate"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def aggregate_global_model_reliability(
    db: Session,
    *,
    computed_at: datetime | None = None,
) -> list[GlobalModelReliability]:
    updated_at = computed_at or _utc_now()
    db.execute(delete(GlobalModelReliability))

    rows = db.execute(
        select(
            func.coalesce(Trace.model_provider, "unknown").label("provider"),
            Trace.model_name.label("model_name"),
            func.count(Trace.id).label("sample_size"),
            func.avg(case((Trace.success.is_(True), 1.0), else_=0.0)).label("success_rate"),
            func.avg(Trace.latency_ms).label("average_latency_ms"),
        )
        .where(Trace.model_name.is_not(None))
        .group_by(func.coalesce(Trace.model_provider, "unknown"), Trace.model_name)
    ).all()

    structured_rows = db.execute(
        select(
            func.coalesce(Trace.model_provider, "unknown").label("provider"),
            Trace.model_name.label("model_name"),
            func.count(Evaluation.id).label("sample_size"),
            func.avg(case((Evaluation.label == "pass", 1.0), else_=0.0)).label("metric_value"),
        )
        .join(Evaluation, Evaluation.trace_id == Trace.id)
        .where(
            Trace.model_name.is_not(None),
            Evaluation.eval_type == STRUCTURED_VALIDITY_EVAL_TYPE,
        )
        .group_by(func.coalesce(Trace.model_provider, "unknown"), Trace.model_name)
    ).all()

    persisted: list[GlobalModelReliability] = []
    for row in rows:
        for metric_name, metric_value in (
            (METRIC_SUCCESS_RATE, row.success_rate),
            (METRIC_AVERAGE_LATENCY_MS, row.average_latency_ms),
        ):
            if metric_value is None:
                continue
            metric = GlobalModelReliability(
                provider=row.provider,
                model_name=row.model_name,
                metric_name=metric_name,
                metric_value=float(metric_value),
                sample_size=int(row.sample_size or 0),
                updated_at=updated_at,
            )
            db.add(metric)
            persisted.append(metric)

    for row in structured_rows:
        metric = GlobalModelReliability(
            provider=row.provider,
            model_name=row.model_name,
            metric_name=METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
            metric_value=float(row.metric_value or 0.0),
            sample_size=int(row.sample_size or 0),
            updated_at=updated_at,
        )
        db.add(metric)
        persisted.append(metric)

    db.flush()
    return persisted


def list_global_model_reliability(db: Session) -> list[dict]:
    rows = db.scalars(
        select(GlobalModelReliability).order_by(
            GlobalModelReliability.provider.asc(),
            GlobalModelReliability.model_name.asc(),
            GlobalModelReliability.metric_name.asc(),
        )
    ).all()
    grouped: dict[tuple[str, str], list[GlobalModelReliability]] = defaultdict(list)
    for row in rows:
        grouped[(row.provider, row.model_name)].append(row)
    return [
        {"provider": provider, "model_name": model_name, "metrics": metrics}
        for (provider, model_name), metrics in grouped.items()
    ]
