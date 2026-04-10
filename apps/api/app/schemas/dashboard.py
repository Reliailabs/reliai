from datetime import datetime
from uuid import UUID

from app.schemas.common import APIModel


class DashboardIncidentAttentionItem(APIModel):
    id: UUID
    title: str
    severity: str
    status: str
    project_id: UUID
    project_name: str
    environment_id: UUID
    started_at: datetime
    acknowledged_at: datetime | None
    path: str


class DashboardIncidentActivityItem(APIModel):
    id: UUID
    title: str
    status: str
    project_name: str
    started_at: datetime
    resolved_at: datetime | None
    path: str


class DashboardInvestigationLinks(APIModel):
    incidents: str
    traces: str
    reliability: str | None = None


class DashboardTriageContext(APIModel):
    active_incident_count: int
    unacknowledged_incident_count: int
    degraded_project_count: int | None = None
    avg_mttr_minutes: float | None = None
    last_updated_at: datetime


class DashboardTriageRead(APIModel):
    attention: list[DashboardIncidentAttentionItem]
    recent_incident_activity: list[DashboardIncidentActivityItem]
    investigation_links: DashboardInvestigationLinks
    context: DashboardTriageContext


class DashboardChangeRead(APIModel):
    id: UUID
    project_id: UUID
    project_name: str
    environment: str | None
    kind: str
    summary: str
    created_at: datetime
    actor: str | None = None
    related_incident_count: int | None = None
    related_regression_count: int | None = None
    path: str | None = None


class DashboardChangeFeedRead(APIModel):
    changes: list[DashboardChangeRead]
