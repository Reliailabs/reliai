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


class ControlPanelModelReliabilityRead(APIModel):
    current_model: str | None
    success_rate: float | None
    average_latency: float | None
    structured_output_validity: float | None


class ProjectReliabilityControlPanelRead(APIModel):
    deployment_risk: ControlPanelDeploymentRiskRead
    simulation: ControlPanelSimulationRead
    incidents: ControlPanelIncidentsRead
    guardrails: ControlPanelGuardrailsRead
    model_reliability: ControlPanelModelReliabilityRead
