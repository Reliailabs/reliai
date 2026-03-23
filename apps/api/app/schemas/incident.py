from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.alert_delivery import AlertDeliveryRead
from app.schemas.common import APIModel
from app.schemas.deployment import (
    DeploymentRiskRead,
    DeploymentSimulationRead,
    IncidentDeploymentContextRead,
)
from app.schemas.incident_event import IncidentEventRead
from app.schemas.investigation import (
    CohortPivotRead,
    DimensionSummaryRead,
    ModelVersionContextRead,
    PromptVersionContextRead,
    RootCauseHintRead,
)
from app.schemas.root_cause_analysis import RootCauseProbabilityRead, RootCauseRecommendedFixRead
from app.schemas.regression import RegressionSnapshotRead
from app.schemas.timeline import TimelineEventRead
from app.schemas.trace import TraceCompareItemRead


class IncidentListQuery(BaseModel):
    project_id: UUID | None = None
    environment: str | None = Field(default=None, max_length=64)
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
    environment_id: UUID
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


class IncidentCommandCenterRootCauseRead(APIModel):
    incident_id: UUID
    generated_at: datetime
    root_cause_probabilities: list[RootCauseProbabilityRead]
    evidence: dict[str, Any]
    recommended_fix: RootCauseRecommendedFixRead
    top_root_cause_probability: float | None = None
    recommendation_confidence: float | None = None
    recommendation_kind: str | None = None
    recommended_action_reason: str | None = None


class IncidentCommandTraceCompareRead(APIModel):
    failing_trace_summary: TraceCompareItemRead | None
    baseline_trace_summary: TraceCompareItemRead | None
    compare_link: str


class GuardrailActivityRead(APIModel):
    policy_type: str
    trigger_count: int
    last_trigger_time: datetime | None


class IncidentCommandCenterMetricRead(APIModel):
    metric_name: str
    metric_type: str
    display_name: str
    unit: str | None = None
    value: str | None = None
    baseline_value: str | None = None
    delta_percent: str | None = None


class IncidentCommandCenterRead(APIModel):
    incident: IncidentDetailRead
    root_cause: IncidentCommandCenterRootCauseRead
    metric: IncidentCommandCenterMetricRead | None = None
    trace_compare: IncidentCommandTraceCompareRead
    deployment_context: IncidentDeploymentContextRead | None
    guardrail_activity: list[GuardrailActivityRead]
    possible_root_causes: list[dict[str, Any]]
    graph_related_patterns: list[dict[str, Any]]
    similar_platform_failures: list[dict[str, Any]]
    recommended_mitigations: list[str]
    related_regressions: list[RegressionSnapshotRead]
    recent_signals: list[TimelineEventRead]


class InvestigationKeyDifferenceRead(APIModel):
    dimension: str
    title: str
    current_value: str | None
    baseline_value: str | None
    changed: bool
    metadata_json: dict[str, Any] | None = None


class InvestigationRecommendationRead(APIModel):
    recommendation_id: UUID | None
    recommended_action: str
    confidence: float
    supporting_evidence: dict[str, Any]


class InvestigationDeploymentContextRead(APIModel):
    deployment: IncidentDeploymentContextRead | None
    latest_risk_score: DeploymentRiskRead | None
    latest_simulation: DeploymentSimulationRead | None
    deployment_link: str | None


class IncidentInvestigationTraceComparisonRead(APIModel):
    compare_link: str
    failing_trace_summary: TraceCompareItemRead | None
    baseline_trace_summary: TraceCompareItemRead | None
    comparison: dict[str, Any]
    key_differences: list[InvestigationKeyDifferenceRead]


class IncidentInvestigationRootCauseRead(APIModel):
    incident_id: UUID
    generated_at: datetime
    ranked_causes: list[RootCauseProbabilityRead]
    evidence: dict[str, Any]
    recommended_fix: RootCauseRecommendedFixRead
    top_root_cause_probability: float | None = None
    recommendation_confidence: float | None = None
    recommendation_kind: str | None = None
    recommended_action_reason: str | None = None


class IncidentInvestigationRead(APIModel):
    incident: IncidentDetailRead
    root_cause_analysis: IncidentInvestigationRootCauseRead
    deployment_context: InvestigationDeploymentContextRead
    trace_comparison: IncidentInvestigationTraceComparisonRead
    recommendations: list[InvestigationRecommendationRead]
    guardrail_activity: list[GuardrailActivityRead]
    possible_root_causes: list[dict[str, Any]]


class IncidentOwnerAssignRequest(BaseModel):
    owner_operator_user_id: UUID | None = None
