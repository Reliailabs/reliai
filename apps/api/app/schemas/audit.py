from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.audit_enums import (
    AuditArtifactType,
    AuditFindingStatus,
    AuditRunStatus,
    AuditSeverity,
    AuditStageKey,
    AuditStageStatus,
    AuditStatus,
    AuditType,
    CertificationStatus,
    OriginSource,
    PolicyProfile,
)
from app.schemas.common import APIModel


class AuditCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    target_system_name: str = Field(min_length=2, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    audit_type: AuditType
    policy_profile: PolicyProfile | None = None
    description: str | None = None
    use_cases: list[str] = []
    workflow_summary: str | None = None
    endpoints_notes: str | None = None
    risk_focus_areas: list[str] = []
    project_id: UUID | None = None
    environment: str | None = None
    linked_production_enabled: bool = False
    evidence_window_days: int = Field(default=14, ge=1, le=90)
    include_incidents: bool = True
    include_trace_samples: bool = True
    include_guardrail_violations: bool = True
    include_regressions: bool = True
    include_model_changes: bool = True


class AuditRunCreateRequest(BaseModel):
    pass


class EvidenceWindowSummary(APIModel):
    days: int
    start: str
    end: str


class IncidentSummary(APIModel):
    count: int
    criticalCount: int


class TraceSampleSummary(APIModel):
    sampleCount: int
    services: list[str]


class GuardrailViolationSummary(APIModel):
    count: int


class RegressionSummary(APIModel):
    count: int


class ModelChangeItem(APIModel):
    provider: str | None
    modelName: str | None
    modelVersion: str | None
    deployedAt: str | None


class ModelChangeSummary(APIModel):
    count: int
    models: list[ModelChangeItem]


class ProductionSnapshotMetadata(APIModel):
    evidenceWindow: EvidenceWindowSummary
    incidentSummary: IncidentSummary
    traceSampleSummary: TraceSampleSummary
    guardrailViolationSummary: GuardrailViolationSummary
    regressionSummary: RegressionSummary
    modelChangeSummary: ModelChangeSummary
    topRiskySurfaces: list[str]


class AuditRead(APIModel):
    id: UUID
    organization_id: UUID
    name: str
    target_system_name: str
    company_name: str | None
    audit_type: AuditType
    policy_profile: PolicyProfile
    description: str | None
    use_cases: list[str] | None
    workflow_summary: str | None
    endpoints_notes: str | None
    risk_focus_areas: list[str] | None
    status: AuditStatus
    project_id: UUID | None
    environment: str | None
    linked_production_enabled: bool
    evidence_window_days: int
    include_incidents: bool
    include_trace_samples: bool
    include_guardrail_violations: bool
    include_regressions: bool
    include_model_changes: bool
    created_at: datetime
    updated_at: datetime


class AuditStageRead(APIModel):
    id: UUID
    audit_run_id: UUID
    organization_id: UUID
    internal_stage_key: str
    stage_key: AuditStageKey
    stage_label: str
    stage_order: int
    status: AuditStageStatus
    summary: str | None
    output_metadata: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AuditArtifactRead(APIModel):
    id: UUID
    audit_run_id: UUID
    organization_id: UUID
    artifact_type: AuditArtifactType
    title: str
    storage_ref: str | None
    metadata_json: dict | None
    is_stale: bool
    created_at: datetime


class AuditFindingRead(APIModel):
    id: UUID
    audit_run_id: UUID
    organization_id: UUID
    title: str
    category: str
    severity: AuditSeverity
    summary: str
    evidence: str | None
    repro_steps: list[str] | None
    confidence: float | None
    status: AuditFindingStatus
    origin_source: OriginSource
    source_stage_key: str | None
    evidence_type: str | None
    evidence_ref: str | None
    finding_fingerprint: str | None
    is_validated: bool
    validated_at: datetime | None
    monitoring_recommended: bool
    certification_blocking: bool
    recommended_monitor_type: str | None
    recommended_scope: str | None
    recommended_threshold_hint: str | None
    is_stale: bool
    created_at: datetime
    updated_at: datetime


class AuditRunRead(APIModel):
    id: UUID
    audit_id: UUID
    organization_id: UUID
    status: AuditRunStatus
    current_stage_key: AuditStageKey
    risk_score: float | None
    certification_status: CertificationStatus
    certification_effective_at: datetime | None
    evidence_window_start: datetime | None
    evidence_window_end: datetime | None
    production_snapshot_metadata: ProductionSnapshotMetadata | None
    snapshot_description: str | None
    snapshot_use_cases: list[str] | None
    snapshot_workflow_summary: str | None
    snapshot_endpoints_notes: str | None
    snapshot_risk_focus_areas: list[str] | None
    snapshot_target_system_name: str | None
    snapshot_environment: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AuditListItemRead(APIModel):
    audit: AuditRead
    latest_run: AuditRunRead | None
    latest_run_stages: list[AuditStageRead] = []


class AuditListResponse(BaseModel):
    items: list[AuditListItemRead]


class AuditRunListResponse(BaseModel):
    items: list[AuditRunRead]


class FindingsSummaryRead(APIModel):
    total: int
    validated: int
    critical_open: int
    blocking_open: int
    severity_counts: dict[str, int]


class ReportNarrativeRead(APIModel):
    decision: str
    risk_level: str
    blocker_status: str
    required_next_action: str
    top_blockers: list[str]
    required_remediation: list[str]
    recommended_improvements: list[str]
    evidence_impact_summary: str
    next_step_guidance: str
    summary: str


class AuditResultsRead(APIModel):
    audit: AuditRead
    run: AuditRunRead
    stages: list[AuditStageRead]
    findings: list[AuditFindingRead]
    findings_summary: FindingsSummaryRead
    artifacts: list[AuditArtifactRead]
    top_risks: list[str]
    summary: str
    recommended_actions: list[str]
    report_narrative: ReportNarrativeRead
    monitoring_recommendations: list[dict]


class AuditDetailResponse(APIModel):
    audit: AuditRead
    latest_run: AuditRunRead | None
    stages: list[AuditStageRead]
    findings_summary: FindingsSummaryRead
    artifacts: list[AuditArtifactRead]
    linked_production_context: ProductionSnapshotMetadata | None
    recent_runs: list[AuditRunRead] = []


class AuditActionResponse(APIModel):
    audit: AuditRead
    run: AuditRunRead
    stages: list[AuditStageRead]
