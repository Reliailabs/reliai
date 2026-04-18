from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.audit_enums import AuditRiskLevel, CertificationStatus
from app.schemas.common import APIModel


class MonitoringRecommendationRead(APIModel):
    id: str
    finding_id: UUID
    recommendation_type: str
    scope: str | None
    threshold_hint: str | None
    reason: str


class ProjectAuditSummaryRead(APIModel):
    project_id: UUID
    organization_id: UUID
    latest_audit_id: UUID | None
    latest_audit_run_id: UUID | None
    certification_status: CertificationStatus
    audit_risk_score: float | None
    audit_risk_level: AuditRiskLevel | None
    open_critical_findings_count: int
    open_blocking_findings_count: int
    latest_audit_completed_at: datetime | None
    certification_at_risk: bool
    certification_risk_reason: str | None


class ProjectMonitoringRecommendationListResponse(BaseModel):
    items: list[MonitoringRecommendationRead]
