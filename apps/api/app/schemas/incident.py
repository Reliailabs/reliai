from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.alert_delivery import AlertDeliveryRead
from app.schemas.common import APIModel
from app.schemas.deployment import IncidentDeploymentContextRead
from app.schemas.incident_event import IncidentEventRead
from app.schemas.investigation import (
    CohortPivotRead,
    DimensionSummaryRead,
    ModelVersionContextRead,
    PromptVersionContextRead,
    RootCauseHintRead,
)
from app.schemas.regression import RegressionSnapshotRead
from app.schemas.trace import TraceCompareItemRead


class IncidentListQuery(BaseModel):
    project_id: UUID | None = None
    scope_type: str | None = Field(default=None, pattern=r"^(project|prompt_version)$")
    scope_id: str | None = None
    status: str | None = Field(default=None, pattern=r"^(open|resolved)$")
    severity: str | None = Field(default=None, pattern=r"^(critical|high|medium|low)$")
    owner_operator_user_id: UUID | None = None
    owner_state: str | None = Field(default=None, pattern=r"^(assigned|unassigned)$")
    date_from: date | None = None
    date_to: date | None = None
    limit: int = Field(default=25, ge=1, le=100)


class IncidentTraceSampleRead(APIModel):
    id: UUID
    request_id: str
    timestamp: datetime
    success: bool
    error_type: str | None
    latency_ms: int | None
    total_cost_usd: Decimal | None


class IncidentListItemRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    project_name: str
    incident_type: str
    severity: str
    title: str
    status: str
    fingerprint: str
    summary_json: dict[str, Any]
    started_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    acknowledged_at: datetime | None
    acknowledged_by_operator_user_id: UUID | None
    acknowledged_by_operator_email: str | None
    owner_operator_user_id: UUID | None
    owner_operator_email: str | None
    latest_alert_delivery: AlertDeliveryRead | None


class IncidentListResponse(BaseModel):
    items: list[IncidentListItemRead]


class IncidentRuleContextRead(APIModel):
    incident_type: str
    metric_name: str
    comparator: str
    absolute_threshold: Decimal
    percent_threshold: Decimal | None
    minimum_sample_size: int


class IncidentCompareRead(APIModel):
    current_window_start: datetime | None
    current_window_end: datetime | None
    baseline_window_start: datetime | None
    baseline_window_end: datetime | None
    regressions: list[RegressionSnapshotRead]
    representative_traces: list[IncidentTraceSampleRead]
    current_representative_traces: list[TraceCompareItemRead]
    baseline_representative_traces: list[TraceCompareItemRead]
    root_cause_hints: list[RootCauseHintRead]
    dimension_summaries: list[DimensionSummaryRead]
    prompt_version_contexts: list[PromptVersionContextRead]
    model_version_contexts: list[ModelVersionContextRead]
    cohort_pivots: list[CohortPivotRead]
    rule_context: IncidentRuleContextRead | None
    trace_compare_path: str


class IncidentDetailRead(IncidentListItemRead):
    regressions: list[RegressionSnapshotRead]
    traces: list[IncidentTraceSampleRead]
    events: list[IncidentEventRead] = []
    compare: IncidentCompareRead
    deployment_context: IncidentDeploymentContextRead | None = None


class IncidentOwnerAssignRequest(BaseModel):
    owner_operator_user_id: UUID | None = None
