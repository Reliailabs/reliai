from enum import StrEnum


class AuditStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    FAILED = "failed"


class AuditRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    NEEDS_REVIEW = "needs_review"
    COMPLETED = "completed"
    FAILED = "failed"


class AuditStageStatus(StrEnum):
    NOT_STARTED = "not_started"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CertificationStatus(StrEnum):
    PENDING = "pending"
    PASS = "pass"
    FAIL = "fail"
    CONDITIONAL = "conditional"


class AuditSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OriginSource(StrEnum):
    MANUAL = "manual"
    PRODUCTION_SIGNAL = "production_signal"
    AUDIT_TEST = "audit_test"
    HYBRID = "hybrid"


class AuditRiskLevel(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class AuditType(StrEnum):
    PRODUCTION_READINESS = "production_readiness"
    HALLUCINATION_RELIABILITY = "hallucination_reliability"
    GUARDRAILS_SAFETY = "guardrails_safety"
    COMPLIANCE_GOVERNANCE = "compliance_governance"
    CUSTOM = "custom"


class PolicyProfile(StrEnum):
    PRODUCTION_READINESS = "production_readiness"
    HALLUCINATION_RELIABILITY = "hallucination_reliability"
    GUARDRAILS_SAFETY = "guardrails_safety"
    COMPLIANCE_GOVERNANCE = "compliance_governance"
    CUSTOM = "custom"


class AuditArtifactType(StrEnum):
    PRODUCTION_INCIDENT_SUMMARY = "production_incident_summary"
    PRODUCTION_TRACE_SAMPLE_BUNDLE = "production_trace_sample_bundle"
    GUARDRAIL_VIOLATION_SUMMARY = "guardrail_violation_summary"
    REGRESSION_SUMMARY = "regression_summary"
    MODEL_CHANGE_SUMMARY = "model_change_summary"
    STAGE_OUTPUT = "stage_output"
    EXECUTIVE_REPORT = "executive_report"
    CERTIFICATION_REPORT = "certification_report"
    EVIDENCE_BUNDLE = "evidence_bundle"


class AuditFindingStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    ACCEPTED_RISK = "accepted_risk"


class InternalAuditStageKey(StrEnum):
    SCOPE_ANALYST = "scope_analyst"
    COMPLIANCE_AUDITOR = "compliance_auditor"
    MODEL_QA_SPECIALIST = "model_qa_specialist"
    COMPLIANCE_REVIEW_BUREAU = "compliance_review_bureau"
    CERTIFICATION_AUTHORITY = "certification_authority"


class AuditStageKey(StrEnum):
    SCOPING = "scoping"
    TESTING = "testing"
    VALIDATION = "validation"
    REVIEW = "review"
    CERTIFICATION = "certification"
