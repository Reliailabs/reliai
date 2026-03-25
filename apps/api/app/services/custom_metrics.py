from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_custom_metric import ProjectCustomMetric
from app.schemas.custom_metric import ProjectCustomMetricCreate


@dataclass(frozen=True)
class CustomMetricEvaluationResult:
    metric_key: str
    metric_name: str
    value_mode: str
    value: float
    matched: bool
    match_count: int
    status: str
    error: str | None


def _slugify_metric_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")
    return slug[:80] or "metric"


def create_project_custom_metric(
    db: Session,
    *,
    project: Project,
    payload: ProjectCustomMetricCreate,
) -> ProjectCustomMetric:
    base_key = _slugify_metric_name(payload.name)
    metric_key = base_key
    suffix = 2
    while db.scalar(
        select(ProjectCustomMetric).where(
            ProjectCustomMetric.project_id == project.id,
            ProjectCustomMetric.metric_key == metric_key,
        )
    ) is not None:
        metric_key = f"{base_key}_{suffix}"
        suffix += 1

    metric = ProjectCustomMetric(
        project_id=project.id,
        name=payload.name.strip(),
        metric_key=metric_key,
        metric_type=payload.metric_type,
        value_mode=payload.value_mode,
        pattern=payload.pattern.strip() if payload.pattern else None,
        keywords_json=payload.keywords,
        enabled=payload.enabled,
        metadata_json=payload.metadata_json,
    )
    db.add(metric)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Custom metric key already exists for this project",
        ) from exc
    db.refresh(metric)
    return metric


def list_project_custom_metrics(db: Session, *, project_id: UUID) -> list[ProjectCustomMetric]:
    return db.scalars(
        select(ProjectCustomMetric)
        .where(ProjectCustomMetric.project_id == project_id)
        .order_by(ProjectCustomMetric.created_at.asc(), ProjectCustomMetric.id.asc())
    ).all()


def list_enabled_project_custom_metrics(db: Session, *, project_id: UUID) -> list[ProjectCustomMetric]:
    return db.scalars(
        select(ProjectCustomMetric)
        .where(ProjectCustomMetric.project_id == project_id, ProjectCustomMetric.enabled.is_(True))
        .order_by(ProjectCustomMetric.created_at.asc(), ProjectCustomMetric.id.asc())
    ).all()


def set_project_custom_metric_enabled(
    db: Session,
    *,
    project_id: UUID,
    metric_id: UUID,
    enabled: bool,
) -> ProjectCustomMetric:
    metric = db.scalar(
        select(ProjectCustomMetric).where(
            ProjectCustomMetric.id == metric_id,
            ProjectCustomMetric.project_id == project_id,
        )
    )
    if metric is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom metric not found")
    metric.enabled = enabled
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


def custom_metric_eval_type(metric: ProjectCustomMetric) -> str:
    return f"custom_metric:{metric.metric_key}"


def custom_metric_rollup_name(metric: ProjectCustomMetric) -> str:
    return f"custom_metric.{metric.metric_key}"


def parse_custom_metric_key(metric_name: str) -> str | None:
    prefix = "custom_metric."
    if metric_name.startswith(prefix):
        return metric_name[len(prefix):]
    return None


def evaluate_custom_metric_on_text(
    *,
    metric: ProjectCustomMetric,
    output_text: str | None,
) -> CustomMetricEvaluationResult:
    text = output_text or ""
    if metric.metric_type == "regex":
        pattern = metric.pattern or ""
        try:
            matches = re.findall(pattern, text, flags=re.IGNORECASE)
        except re.error as exc:
            return CustomMetricEvaluationResult(
                metric_key=metric.metric_key,
                metric_name=metric.name,
                value_mode=metric.value_mode,
                value=0.0,
                matched=False,
                match_count=0,
                status="invalid_pattern",
                error=str(exc),
            )
        match_count = len(matches)
    else:
        keywords = [item.lower() for item in (metric.keywords_json or []) if item]
        lowered = text.lower()
        match_count = sum(lowered.count(keyword) for keyword in keywords)

    if metric.value_mode == "boolean":
        value = 1.0 if match_count > 0 else 0.0
    else:
        value = float(match_count)

    return CustomMetricEvaluationResult(
        metric_key=metric.metric_key,
        metric_name=metric.name,
        value_mode=metric.value_mode,
        value=value,
        matched=match_count > 0,
        match_count=match_count,
        status="ok",
        error=None,
    )


def metric_value_from_evaluation_raw(raw_result_json: dict | None) -> float | None:
    if not raw_result_json:
        return None
    value = raw_result_json.get("result_value")
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return None


def metric_hit_from_evaluation_raw(raw_result_json: dict | None) -> bool:
    value = metric_value_from_evaluation_raw(raw_result_json)
    return bool(value and value > 0)


def serialize_custom_metric_result_rows(
    metrics: Iterable[ProjectCustomMetric],
    *,
    evaluation_by_type: dict[str, object],
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for metric in metrics:
        evaluation = evaluation_by_type.get(custom_metric_eval_type(metric))
        if evaluation is None:
            continue
        raw = getattr(evaluation, "raw_result_json", None)
        value = metric_value_from_evaluation_raw(raw)
        rows.append(
            {
                "metric_key": metric.metric_key,
                "name": metric.name,
                "mode": metric.value_mode,
                "value": value,
                "matched": metric_hit_from_evaluation_raw(raw),
            }
        )
    return rows
