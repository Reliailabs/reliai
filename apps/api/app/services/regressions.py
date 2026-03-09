from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.evaluation_rollup import EvaluationRollup
from app.models.incident import Incident
from app.models.regression_snapshot import RegressionSnapshot
from app.schemas.regression import RegressionListQuery
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.rollups import (
    ROLLUP_METRICS,
    ROLLUP_WINDOW_MINUTES,
    RollupScope,
    build_baseline_window,
    build_current_window,
    compute_rollups_for_scope,
    quantize_decimal,
)

INCIDENT_WINDOW_MINUTES = 60


@dataclass(frozen=True)
class RegressionComputationResult:
    scope: RollupScope
    snapshots: list[RegressionSnapshot]


def _baseline_rollup(
    db: Session, *, scope: RollupScope, metric_name: str, baseline_window
) -> EvaluationRollup:
    record = db.scalar(
        select(EvaluationRollup).where(
            EvaluationRollup.scope_type == scope.scope_type,
            EvaluationRollup.scope_id == scope.scope_id,
            EvaluationRollup.metric_name == metric_name,
            EvaluationRollup.window_minutes == baseline_window.minutes,
        )
    )
    if record and record.window_start == baseline_window.start and record.window_end == baseline_window.end:
        return record

    baseline_map = compute_rollups_for_scope(db, scope=scope, anchor_time=baseline_window.end)
    return baseline_map[baseline_window.minutes][metric_name]


def compute_regressions_for_scope(
    db: Session,
    *,
    scope: RollupScope,
    anchor_time: datetime,
) -> RegressionComputationResult:
    current_rollups = compute_rollups_for_scope(db, scope=scope, anchor_time=anchor_time)
    current_window = build_current_window(anchor_time, INCIDENT_WINDOW_MINUTES)
    baseline_window = build_baseline_window(current_window)
    snapshots: list[RegressionSnapshot] = []

    for metric_name in ROLLUP_METRICS:
        current_rollup = current_rollups[INCIDENT_WINDOW_MINUTES][metric_name]
        baseline_rollup = _baseline_rollup(
            db, scope=scope, metric_name=metric_name, baseline_window=baseline_window
        )
        delta_absolute = quantize_decimal(current_rollup.metric_value - baseline_rollup.metric_value)
        if baseline_rollup.metric_value == 0:
            delta_percent = None
        else:
            delta_percent = quantize_decimal(delta_absolute / baseline_rollup.metric_value)

        snapshot = db.scalar(
            select(RegressionSnapshot).where(
                RegressionSnapshot.scope_type == scope.scope_type,
                RegressionSnapshot.scope_id == scope.scope_id,
                RegressionSnapshot.metric_name == metric_name,
                RegressionSnapshot.window_minutes == INCIDENT_WINDOW_MINUTES,
            )
        )
        if snapshot is None:
            snapshot = RegressionSnapshot(
                organization_id=scope.organization_id,
                project_id=scope.project_id,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
                metric_name=metric_name,
                window_minutes=INCIDENT_WINDOW_MINUTES,
            )

        snapshot.current_value = current_rollup.metric_value
        snapshot.baseline_value = baseline_rollup.metric_value
        snapshot.delta_absolute = delta_absolute
        snapshot.delta_percent = delta_percent
        snapshot.detected_at = anchor_time
        snapshot.metadata_json = {
            "current_window_start": current_window.start.isoformat(),
            "current_window_end": current_window.end.isoformat(),
            "baseline_window_start": baseline_window.start.isoformat(),
            "baseline_window_end": baseline_window.end.isoformat(),
            "current_sample_size": current_rollup.sample_size,
            "baseline_sample_size": baseline_rollup.sample_size,
        }
        db.add(snapshot)
        db.flush()
        snapshots.append(snapshot)

    return RegressionComputationResult(scope=scope, snapshots=snapshots)


def list_project_regressions(
    db: Session,
    operator: OperatorContext,
    *,
    project_id: UUID,
    query: RegressionListQuery,
) -> list[RegressionSnapshot]:
    require_project_access(db, operator, project_id)
    statement = (
        select(RegressionSnapshot)
        .where(
            RegressionSnapshot.project_id == project_id,
            RegressionSnapshot.organization_id.in_(operator.organization_ids),
        )
        .order_by(desc(RegressionSnapshot.detected_at), RegressionSnapshot.metric_name)
    )
    if query.metric_name is not None:
        statement = statement.where(RegressionSnapshot.metric_name == query.metric_name)
    if query.scope_id is not None:
        statement = statement.where(RegressionSnapshot.scope_id == query.scope_id)
    statement = statement.limit(query.limit)
    return db.scalars(statement).all()


def get_regression_detail(
    db: Session,
    operator: OperatorContext,
    *,
    regression_id: UUID,
) -> tuple[RegressionSnapshot, Incident | None]:
    regression = db.get(RegressionSnapshot, regression_id)
    if regression is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regression not found")
    require_project_access(db, operator, regression.project_id)

    candidate_incidents = db.scalars(
        select(Incident).where(
            Incident.project_id == regression.project_id,
            Incident.organization_id.in_(operator.organization_ids),
        )
    ).all()
    related_incident = None
    for candidate in candidate_incidents:
        snapshot_ids = set(candidate.summary_json.get("regression_snapshot_ids", []))
        if str(regression.id) in snapshot_ids:
            related_incident = candidate
            break
        if (
            candidate.summary_json.get("metric_name") == regression.metric_name
            and candidate.summary_json.get("scope_type") == regression.scope_type
            and candidate.summary_json.get("scope_id") == regression.scope_id
        ):
            related_incident = candidate
    return regression, related_incident
