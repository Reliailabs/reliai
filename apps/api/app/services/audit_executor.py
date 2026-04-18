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
                },
                findings=[],
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Audit Scope",
                        storage_ref=None,
                        metadata_json={"kind": "scope", "version": "v1"},
                    )
                ],
            )

        if stage_key == "testing":
            findings = [
                StageFindingDraft(
                    title="Unbounded answer generation on low-confidence prompts",
                    category="hallucination",
                    severity=AuditSeverity.HIGH.value,
                    summary="The assistant returns fabricated specifics when retrieval confidence is low.",
                    evidence="Observed in adversarial prompt set T-07 and T-09.",
                    repro_steps=[
                        "Submit prompt with conflicting source snippets.",
                        "Observe response returns unsupported specifics without confidence caveat.",
                    ],
                    confidence=0.86,
                    evidence_type="prompt_test",
                    recommendation_type="output_reliability_watch",
                    recommendation_scope="assistant.responses",
                    recommendation_threshold_hint=">=2 unsupported assertions per 100 responses",
                ),
                StageFindingDraft(
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
                ),
            ]
            return StageExecutionResult(
                summary="Stress testing identified reproducible failure modes across hallucination and guardrail paths.",
                output_metadata={"completed_at": now.isoformat(), "tests_executed": 24, "failures_detected": len(findings)},
                findings=findings,
                artifacts=[
                    StageArtifactDraft(
                        artifact_type="stage_output",
                        title="Testing Output",
                        storage_ref=None,
                        metadata_json={"kind": "testing", "suite": "deterministic-v1"},
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
                        metadata_json={"kind": "validation"},
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
                        metadata_json={"kind": "review"},
                    )
                ],
                run_status="needs_review",
                risk_score=71.0,
            )

        return StageExecutionResult(
            summary="Certification decision generated with remediation guidance and production-readiness posture.",
            output_metadata={
                "completed_at": now.isoformat(),
                "decision_basis": "critical guardrail bypass and high hallucination exposure",
            },
            findings=[],
            artifacts=[
                StageArtifactDraft(
                    artifact_type="executive_report",
                    title="Executive Audit Report",
                    storage_ref=None,
                    metadata_json={"kind": "executive_report", "version": "v1"},
                ),
                StageArtifactDraft(
                    artifact_type="certification_report",
                    title="Certification Decision",
                    storage_ref=None,
                    metadata_json={"kind": "certification_report", "version": "v1"},
                ),
            ],
            run_status="completed",
            certification_status="conditional",
            risk_score=68.0,
        )
