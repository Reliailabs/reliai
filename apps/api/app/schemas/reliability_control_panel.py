from datetime import datetime
from uuid import UUID

from app.schemas.common import APIModel


class ControlPanelDeploymentRiskRead(APIModel):
    latest_deployment_id: UUID | None
    deployed_at: datetime | None
    risk_score: float | None
    risk_level: str | None


class ControlPanelSimulationRead(APIModel):
    latest_simulation_id: UUID | None
    predicted_failure_rate: float | None
    predicted_latency: float | None
    risk_level: str | None
    created_at: datetime | None


class ControlPanelRecentIncidentRead(APIModel):
    incident_id: UUID
    title: str
    severity: str
    status: str
    started_at: datetime


class ControlPanelIncidentsRead(APIModel):
    recent_incidents: list[ControlPanelRecentIncidentRead]
    incident_rate_last_24h: int


class ControlPanelGuardrailsRead(APIModel):
    trigger_rate_last_24h: int
    top_triggered_policy: str | None


class ControlPanelGuardrailActivityRead(APIModel):
    policy_type: str
    trigger_count: int


class ControlPanelGuardrailComplianceRead(APIModel):
    policy_type: str
    enforcement_mode: str
    coverage_pct: float
    violation_count: int


class ControlPanelModelReliabilityRead(APIModel):
    current_model: str | None
    success_rate: float | None
    average_latency: float | None
    structured_output_validity: float | None


class ControlPanelGraphPatternRead(APIModel):
    pattern: str
    risk_level: str
    trace_count: int
    confidence: float


class ControlPanelRecommendedGuardrailRead(APIModel):
    policy_type: str
    recommended_action: str
    title: str
    confidence: float
    model_family: str | None = None


class ControlPanelModelFailureSignalRead(APIModel):
    pattern: str
    risk_level: str
    confidence: float


class ControlPanelAutomaticActionRead(APIModel):
    action_id: UUID
    action_type: str
    target: str
    status: str
    created_at: datetime


class ControlPanelAutomaticActionsRead(APIModel):
    recent_actions: list[ControlPanelAutomaticActionRead]


class ControlPanelRecentDeploymentRead(APIModel):
    deployment_id: UUID
    deployed_at: datetime
    environment: str
    risk_level: str | None
    risk_score: float | None


class ProjectReliabilityControlPanelRead(APIModel):
    reliability_score: int
    traces_last_24h: int
    traces_per_second: float | None = None
    active_incidents: int
    active_services: int
    deployment_risk: ControlPanelDeploymentRiskRead
    simulation: ControlPanelSimulationRead
    incidents: ControlPanelIncidentsRead
    guardrails: ControlPanelGuardrailsRead
    guardrail_activity: list[ControlPanelGuardrailActivityRead]
    guardrail_compliance: list[ControlPanelGuardrailComplianceRead]
    model_reliability: ControlPanelModelReliabilityRead
    high_risk_patterns: list[ControlPanelGraphPatternRead]
    graph_high_risk_patterns: list[ControlPanelGraphPatternRead]
    recommended_guardrails: list[ControlPanelRecommendedGuardrailRead]
    model_failure_signals: list[ControlPanelModelFailureSignalRead]
    recent_deployments: list[ControlPanelRecentDeploymentRead]
    automatic_actions: ControlPanelAutomaticActionsRead
