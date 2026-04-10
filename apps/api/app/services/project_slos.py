from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.project_slo import ProjectSLO
from app.models.reliability_metric import ReliabilityMetric
from app.services.authorization import require_project_access
from app.services.reliability_metrics import (
    METRIC_DETECTION_COVERAGE,
    METRIC_INCIDENT_DENSITY,
    METRIC_QUALITY_PASS_RATE,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    SCOPE_PROJECT,
)
from app.services.auth import OperatorContext

SLO_TYPE_TO_METRIC = {
    "quality_pass_rate": METRIC_QUALITY_PASS_RATE,
    "incident_free_rate": METRIC_INCIDENT_DENSITY,
    "detection_coverage": METRIC_DETECTION_COVERAGE,
    "structured_output_validity": METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
}


def list_project_slos(db: Session, operator: OperatorContext, *, project_id: UUID) -> Sequence[ProjectSLO]:
    require_project_access(db, operator, project_id)
    return db.scalars(
        select(ProjectSLO)
        .where(ProjectSLO.project_id == project_id)
        .order_by(ProjectSLO.created_at)
    ).all()


def compute_slo_current_value(
    db: Session,
    *,
    project_id: UUID,
    metric_type: str,
    window_days: int,
) -> float | None:
    metric_name = SLO_TYPE_TO_METRIC.get(metric_type)
    if metric_name is None:
        return None
    window_minutes = window_days * 24 * 60
    metric = db.scalar(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == project_id,
            ReliabilityMetric.scope_type == SCOPE_PROJECT,
            ReliabilityMetric.scope_id == str(project_id),
            ReliabilityMetric.metric_name == metric_name,
            ReliabilityMetric.window_minutes == window_minutes,
        )
        .order_by(desc(ReliabilityMetric.window_end), desc(ReliabilityMetric.created_at))
    )
    if metric is None:
        return None
    if metric_type == "incident_free_rate":
        incident_density = metric.value_number
        return max(0.0, (1.0 - min(1.0, incident_density)) * 100.0)
    if metric_type in {"quality_pass_rate", "detection_coverage", "structured_output_validity"}:
        return metric.value_number * 100.0
    return metric.value_number


def compute_slo_status(current: float | None, target: float) -> str | None:
    if current is None:
        return None
    if current >= target:
        return "healthy"
    if current >= target * 0.95:
        return "at_risk"
    return "breached"


def status_to_trend(status: str | None) -> str | None:
    if status is None:
        return None
    if status == "healthy":
        return "up"
    if status == "breached":
        return "down"
    return "flat"


def seed_default_slos(db: Session, *, project_id: UUID, organization_id: UUID) -> None:
    existing = db.scalar(
        select(ProjectSLO).where(ProjectSLO.project_id == project_id)
    )
    if existing is not None:
        return
    defaults = [
        ProjectSLO(
            project_id=project_id,
            organization_id=organization_id,
            name="Quality Pass Rate",
            description="Percentage of traces passing all quality evaluations",
            metric_type="quality_pass_rate",
            target_value=95.0,
            window_days=30,
            enabled=True,
        ),
        ProjectSLO(
            project_id=project_id,
            organization_id=organization_id,
            name="Incident-Free Rate",
            description="Percentage of time without active reliability incidents",
            metric_type="incident_free_rate",
            target_value=90.0,
            window_days=30,
            enabled=True,
        ),
        ProjectSLO(
            project_id=project_id,
            organization_id=organization_id,
            name="Detection Coverage",
            description="Fraction of issues detected by the reliability platform",
            metric_type="detection_coverage",
            target_value=80.0,
            window_days=30,
            enabled=True,
        ),
    ]
    db.add_all(defaults)
    db.commit()
