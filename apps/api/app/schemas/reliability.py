from datetime import datetime
from uuid import UUID

from app.schemas.common import APIModel


class ReliabilityMetricPointRead(APIModel):
    metric_name: str
    window_minutes: int
    window_start: datetime
    window_end: datetime
    value_number: float
    numerator: float | None
    denominator: float | None
    unit: str
    computed_at: datetime
    metadata_json: dict | None


class ReliabilityMetricSeriesRead(APIModel):
    metric_name: str
    unit: str
    points: list[ReliabilityMetricPointRead]


class ReliabilityRecentIncidentRead(APIModel):
    id: UUID
    incident_type: str
    severity: str
    status: str
    title: str
    started_at: datetime
    updated_at: datetime


class ProjectReliabilityRead(APIModel):
    project_id: UUID
    organization_id: UUID
    reliability_score: float | None
    detection_latency_p90: float | None
    MTTA_p90: float | None
    MTTR_p90: float | None
    false_positive_rate: float | None
    detection_coverage: float | None
    alert_delivery_success_rate: float | None
    explainability_score: float | None
    incident_density: float | None
    telemetry_freshness_minutes: float | None
    quality_pass_rate: float | None
    structured_output_validity_rate: float | None
    root_cause_localization_score: float | None
    recent_incidents: list[ReliabilityRecentIncidentRead]
    trend_series: list[ReliabilityMetricSeriesRead]
