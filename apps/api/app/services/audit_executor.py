from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from app.schemas.audit_enums import AuditSeverity


@dataclass
class StageFindingDraft:
    title: str
    category: str
    severity: str
    summary: str
    evidence: str
    repro_steps: list[str]
    confidence: float
    evidence_type: str
    recommendation_type: str | None = None
    recommendation_scope: str | None = None
    recommendation_threshold_hint: str | None = None


@dataclass
class StageArtifactDraft:
    artifact_type: str
    title: str
    storage_ref: str | None
    metadata_json: dict


@dataclass
class StageExecutionResult:
    summary: str
    output_metadata: dict
    findings: list[StageFindingDraft]
    artifacts: list[StageArtifactDraft]
    run_status: str | None = None
    certification_status: str | None = None
    risk_score: float | None = None


class AuditStageExecutor:
    def execute_stage(self, *, run_id: UUID, stage_key: str, context: dict) -> StageExecutionResult:
        raise NotImplementedError


class DeterministicMockAuditStageExecutor(AuditStageExecutor):
    """Deterministic, replaceable stage executor for v1."""

    def execute_stage(self, *, run_id: UUID, stage_key: str, context: dict) -> StageExecutionResult:
        now = datetime.now(timezone.utc)
        project_name = context.get("target_system_name") or "target system"
        audit_type = context.get("audit_type") or "production_readiness"
        policy_profile = context.get("policy_profile") or audit_type
        snapshot = context.get("production_snapshot_metadata") or {}
        top_risky_surfaces = snapshot.get("topRiskySurfaces") or []
        primary_surface = top_risky_surfaces[0] if top_risky_surfaces else "assistant.response"

        if stage_key == "scoping":
            return StageExecutionResult(
                summary=f"Scope finalized for {project_name} with prioritized risk surfaces and test matrix.",
                output_metadata={
                    "completed_at": now.isoformat(),
                    "risk_categories": [
                        "hallucination",
                        "reliability",
                        "guardrails",
                        "compliance",
                    ],
                    "test_plan_count": 14,
                    "audit_type": audit_type,
                    "policy_profile": policy_profile,
                },
                findings=[],
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Audit Scope",
                        storage_ref=None,
                        metadata_json={"kind": "scope", "version": "v1.1"},
                    )
                ],
            )

        if stage_key == "testing":
            if audit_type == "guardrails_safety":
                first_finding = StageFindingDraft(
                    title="Fallback policy routing bypass under malformed tool payload",
                    category="guardrails",
                    severity=AuditSeverity.CRITICAL.value,
                    summary="Malformed nested payloads can bypass block-mode policy checks in fallback routing.",
                    evidence=f"Observed against protected surface `{primary_surface}` with snapshot-linked risk surfaces.",
                    repro_steps=[
                        "Send malformed nested JSON payload to fallback branch.",
                        "Observe policy misses block enforcement and returns unsafe output.",
                    ],
                    confidence=0.92,
                    evidence_type="workflow_test",
                    recommendation_type="guardrail_violation_watch",
                    recommendation_scope=primary_surface,
                    recommendation_threshold_hint=">=1 bypass event in 24h",
                )
                second_finding = StageFindingDraft(
                    title="Policy coverage gap for indirect tool invocation",
                    category="safety",
                    severity=AuditSeverity.HIGH.value,
                    summary="Indirect invocation path is not covered by enforcement policy templates.",
                    evidence="Coverage checks show unprotected indirect tool-call path in test suite G-14.",
                    repro_steps=[
                        "Trigger indirect tool invocation with disguised system instruction.",
                        "Observe invocation path without policy enforcement event.",
                    ],
                    confidence=0.84,
                    evidence_type="policy_coverage",
                    recommendation_type="incident_escalation_watch",
                    recommendation_scope="policy.coverage.indirect_tool",
                    recommendation_threshold_hint=">=3 uncovered invocations per day",
                )
            elif audit_type == "compliance_governance":
                first_finding = StageFindingDraft(
                    title="Insufficient evidence traceability for high-risk responses",
                    category="compliance",
                    severity=AuditSeverity.HIGH.value,
                    summary="High-risk responses lack consistent evidence references in response metadata.",
                    evidence=f"Sampled responses tied to `{primary_surface}` missing verifiable provenance fields.",
                    repro_steps=[
                        "Trigger regulated response workflow with policy-required evidence output.",
                        "Observe response metadata missing source provenance identifiers.",
                    ],
                    confidence=0.88,
                    evidence_type="evidence_traceability",
                    recommendation_type="output_reliability_watch",
                    recommendation_scope="response.provenance",
                    recommendation_threshold_hint=">=5 missing provenance events per 100 responses",
                )
                second_finding = StageFindingDraft(
                    title="Policy exception logging is inconsistent across retry path",
                    category="governance",
                    severity=AuditSeverity.MEDIUM.value,
                    summary="Retry path exceptions are not consistently logged for audit review.",
                    evidence="Observed log omission in retry branch for scenario C-22.",
                    repro_steps=[
                        "Cause policy exception and force retry path.",
                        "Verify audit log stream does not include retry exception metadata.",
                    ],
                    confidence=0.79,
                    evidence_type="audit_log_gap",
                    recommendation_type="regression_watch",
                    recommendation_scope="policy.retry.exceptions",
                    recommendation_threshold_hint=">=2 missing events per day",
                )
            else:
                first_finding = StageFindingDraft(
                    title="Unbounded answer generation on low-confidence prompts",
                    category="hallucination",
                    severity=AuditSeverity.HIGH.value,
                    summary="The assistant returns fabricated specifics when retrieval confidence is low.",
                    evidence=f"Observed on `{primary_surface}` in adversarial prompt set T-07 and T-09.",
                    repro_steps=[
                        "Submit prompt with conflicting source snippets.",
                        "Observe response returns unsupported specifics without confidence caveat.",
                    ],
                    confidence=0.86,
                    evidence_type="prompt_test",
                    recommendation_type="output_reliability_watch",
                    recommendation_scope=primary_surface,
                    recommendation_threshold_hint=">=2 unsupported assertions per 100 responses",
                )
                second_finding = StageFindingDraft(
                    title="Guardrail bypass for nested instruction payloads",
                    category="guardrails",
                    severity=AuditSeverity.CRITICAL.value,
                    summary="Nested payloads can bypass policy checks in specific fallback paths.",
                    evidence="Detected in workflow branch fallback->tool_call with malformed JSON payload.",
                    repro_steps=[
                        "Trigger fallback branch with malformed tool argument payload.",
                        "Observe prohibited category response emitted without guardrail block.",
                    ],
                    confidence=0.91,
                    evidence_type="workflow_test",
                    recommendation_type="guardrail_violation_watch",
                    recommendation_scope="policy.runtime.block",
                    recommendation_threshold_hint=">=1 critical bypass in 24h",
                )

            findings = [first_finding, second_finding]
            return StageExecutionResult(
                summary="Stress testing identified reproducible failure modes across high-impact reliability surfaces.",
                output_metadata={
                    "completed_at": now.isoformat(),
                    "tests_executed": 24,
                    "failures_detected": len(findings),
                    "audit_type": audit_type,
                    "policy_profile": policy_profile,
                },
                findings=findings,
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Testing Output",
                        storage_ref=None,
                        metadata_json={
                            "kind": "testing",
                            "suite": "deterministic-v1.1",
                            "evidence_ref": "production_snapshot_metadata",
                        },
                    )
                ],
            )

        if stage_key == "validation":
            return StageExecutionResult(
                summary="Findings were re-tested, false positives removed, and confidence scores updated.",
                output_metadata={"completed_at": now.isoformat(), "validated_ratio": 0.92},
                findings=[],
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Validation Summary",
                        storage_ref=None,
                        metadata_json={"kind": "validation", "version": "v1.1"},
                    )
                ],
            )

        if stage_key == "review":
            return StageExecutionResult(
                summary="Cross-finding review consolidated systemic risk and normalized severity impact.",
                output_metadata={"completed_at": now.isoformat(), "systemic_patterns": 2},
                findings=[],
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Risk Review",
                        storage_ref=None,
                        metadata_json={"kind": "review", "version": "v1.1"},
                    )
                ],
                run_status="needs_review",
                risk_score=71.0,
            )

        return StageExecutionResult(
            summary="Certification decision generated with remediation guidance and production-readiness posture.",
            output_metadata={
                "completed_at": now.isoformat(),
                "decision_basis": "severity-weighted findings and validated production evidence snapshot",
                "audit_type": audit_type,
                "policy_profile": policy_profile,
            },
            findings=[],
            artifacts=[
                StageArtifactDraft(
                    artifact_type="executive_report",
                    title="Executive Audit Report",
                    storage_ref=None,
                    metadata_json={
                        "kind": "executive_report",
                        "version": "v1.1",
                        "narrative": f"{project_name} requires remediation before fully reliable certification.",
                        "priority_surfaces": top_risky_surfaces[:3],
                    },
                ),
                StageArtifactDraft(
                    artifact_type="certification_report",
                    title="Certification Decision",
                    storage_ref=None,
                    metadata_json={
                        "kind": "certification_report",
                        "version": "v1.1",
                        "decision": "conditional",
                        "blockers": ["critical guardrail path", "high-severity reliability gap"],
                    },
                ),
            ],
            run_status="completed",
            certification_status="conditional",
            risk_score=68.0,
        )
