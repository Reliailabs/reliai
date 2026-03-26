from __future__ import annotations

from dataclasses import dataclass
import difflib
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.prompt_version import PromptVersion
from app.models.deployment_simulation import DeploymentSimulation
from app.models.reliability_recommendation import ReliabilityRecommendation
from app.services.auth import OperatorContext
from app.services.incident_command_center import get_incident_command_center
from app.services.incidents import build_trace_compare_item, build_trace_diff_blocks
from app.services.reliability_recommendations import get_active_recommendations


@dataclass(frozen=True)
class InvestigationRecommendation:
    recommendation: ReliabilityRecommendation | None
    recommended_action: str
    confidence: float
    supporting_evidence: dict


@dataclass(frozen=True)
class IncidentInvestigationResult:
    command_center: object
    latest_simulation: DeploymentSimulation | None
    recommendations: list[InvestigationRecommendation]
    comparison: dict
    key_differences: list[dict]


def _prompt_body(record: PromptVersion) -> str:
    body = (record.notes or record.label or "").strip()
    if body:
        return body
    return f"[No prompt content stored for version {record.version}]"


def _select_prompt_record(db: Session, *, project_id: UUID, traces) -> PromptVersion | None:
    by_record: dict[UUID, int] = {}
    by_version: dict[str, int] = {}
    for trace in traces:
        if trace.prompt_version_record_id is not None:
            by_record[trace.prompt_version_record_id] = by_record.get(trace.prompt_version_record_id, 0) + 1
        elif trace.prompt_version:
            by_version[trace.prompt_version] = by_version.get(trace.prompt_version, 0) + 1
    if by_record:
        record_id = sorted(by_record.items(), key=lambda item: (-item[1], str(item[0])))[0][0]
        return db.get(PromptVersion, record_id)
    if by_version:
        version = sorted(by_version.items(), key=lambda item: (-item[1], item[0]))[0][0]
        return db.scalar(
            select(PromptVersion).where(
                PromptVersion.project_id == project_id,
                PromptVersion.version == version,
            )
        )
    return None


def compute_prompt_content_diff(
    db: Session,
    *,
    project_id: UUID,
    current_traces,
    baseline_traces,
) -> dict | None:
    current_prompt = _select_prompt_record(db, project_id=project_id, traces=current_traces)
    baseline_prompt = _select_prompt_record(db, project_id=project_id, traces=baseline_traces)
    if current_prompt is None or baseline_prompt is None:
        return None
    from_text = _prompt_body(baseline_prompt)
    to_text = _prompt_body(current_prompt)
    diff_lines = list(
        difflib.unified_diff(
            from_text.splitlines(),
            to_text.splitlines(),
            fromfile=f"prompt:{baseline_prompt.version}",
            tofile=f"prompt:{current_prompt.version}",
            lineterm="",
        )
    )
    if not diff_lines:
        diff_lines = [f"@@ prompt content identical between {baseline_prompt.version} and {current_prompt.version} @@"] 
    return {
        "from_version": baseline_prompt.version,
        "to_version": current_prompt.version,
        "diff": diff_lines,
    }

def _key_differences(trace_compare) -> list[dict]:
    if trace_compare is None:
        return []
    diff_blocks = build_trace_diff_blocks(trace_compare.trace, trace_compare.baseline_trace)
    selected = []
    for block in diff_blocks:
        if not block.get("changed"):
            continue
        if block["block_type"] not in {"model_prompt", "performance", "retrieval", "outcome"}:
            continue
        selected.append(
            {
                "dimension": block["block_type"],
                "title": block["title"],
                "current_value": block.get("current_value"),
                "baseline_value": block.get("baseline_value"),
                "changed": bool(block.get("changed")),
                "metadata_json": block.get("metadata_json"),
            }
        )
    return selected


def _comparison_payload(trace_compare) -> dict:
    if trace_compare is None:
        return {
            "current_window_start": None,
            "current_window_end": None,
            "baseline_window_start": None,
            "baseline_window_end": None,
            "failing_trace": None,
            "baseline_trace": None,
            "diff_blocks": [],
        }
    return {
        "current_window_start": trace_compare.current_window_start,
        "current_window_end": trace_compare.current_window_end,
        "baseline_window_start": trace_compare.baseline_window_start,
        "baseline_window_end": trace_compare.baseline_window_end,
        "failing_trace": build_trace_compare_item(trace_compare.trace),
        "baseline_trace": build_trace_compare_item(trace_compare.baseline_trace)
        if trace_compare.baseline_trace is not None
        else None,
        "diff_blocks": build_trace_diff_blocks(trace_compare.trace, trace_compare.baseline_trace),
    }


def _recommendation_matches(recommendation: ReliabilityRecommendation, *, incident, cause_types: set[str]) -> bool:
    evidence = recommendation.evidence_json or {}
    related_incident_types = evidence.get("related_incident_types")
    related_cause_types = evidence.get("related_cause_types")
    metric_name = evidence.get("metric_name")
    if isinstance(related_incident_types, list) and incident.incident_type in related_incident_types:
        return True
    if isinstance(related_cause_types, list) and any(cause in related_cause_types for cause in cause_types):
        return True
    return metric_name == incident.summary_json.get("metric_name")


def _rank_recommendations(*, incident, root_cause_report, items: list[ReliabilityRecommendation]) -> list[InvestigationRecommendation]:
    if not items:
        top_probability = (
            root_cause_report.root_cause_probabilities[0]
            if root_cause_report.root_cause_probabilities
            else {"cause_type": "insufficient_signal", "probability": 0.42}
        )
        recommended_fix = root_cause_report.recommended_fix
        return [
            InvestigationRecommendation(
                recommendation=None,
                recommended_action=recommended_fix["summary"],
                confidence=round(float(top_probability.get("probability", 0.42)), 2),
                supporting_evidence={
                    "recommendation_type": "root_cause_fallback",
                    "severity": incident.severity,
                    "description": recommended_fix["summary"],
                    "evidence_json": {
                        "cause_type": top_probability.get("cause_type"),
                        **(recommended_fix.get("metadata_json") or {}),
                    },
                },
            )
        ]
    cause_types = {
        item["cause_type"] for item in root_cause_report.root_cause_probabilities if item["cause_type"] != "insufficient_signal"
    }
    top_probability = (
        float(root_cause_report.root_cause_probabilities[0]["probability"])
        if root_cause_report.root_cause_probabilities
        else 0.5
    )
    ranked: list[InvestigationRecommendation] = []
    for item in items:
        if not _recommendation_matches(item, incident=incident, cause_types=cause_types):
            continue
        ranked.append(
            InvestigationRecommendation(
                recommendation=item,
                recommended_action=item.title,
                confidence=round(min(0.95, max(0.35, top_probability)), 2),
                supporting_evidence={
                    "recommendation_type": item.recommendation_type,
                    "severity": item.severity,
                    "description": item.description,
                    "evidence_json": item.evidence_json,
                },
            )
        )
    if ranked:
        return ranked[:3]

    fallback = items[0]
    return [
        InvestigationRecommendation(
            recommendation=fallback,
            recommended_action=fallback.title,
            confidence=0.42,
            supporting_evidence={
                "recommendation_type": fallback.recommendation_type,
                "severity": fallback.severity,
                "description": fallback.description,
                "evidence_json": fallback.evidence_json,
            },
        )
    ]


def get_incident_investigation(
    db: Session,
    operator: OperatorContext,
    incident_id: UUID,
) -> IncidentInvestigationResult:
    command = get_incident_command_center(db, operator, incident_id)
    active_recommendations = get_active_recommendations(db, command.incident.project_id)

    latest_simulation = db.scalar(
        select(DeploymentSimulation)
        .where(DeploymentSimulation.project_id == command.incident.project_id)
        .order_by(desc(DeploymentSimulation.created_at), desc(DeploymentSimulation.id))
    )

    return IncidentInvestigationResult(
        command_center=command,
        latest_simulation=latest_simulation,
        recommendations=_rank_recommendations(
            incident=command.incident,
            root_cause_report=command.root_cause_report,
            items=active_recommendations,
        ),
        comparison=_comparison_payload(command.trace_compare),
        key_differences=_key_differences(command.trace_compare),
    )
