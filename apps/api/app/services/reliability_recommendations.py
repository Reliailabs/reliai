from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_simulation import DeploymentSimulation
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.project import Project
from app.models.reliability_recommendation import ReliabilityRecommendation
from app.services.guardrail_recommendations import recommend_guardrails_from_patterns
from app.services.reliability_graph import get_graph_guardrail_recommendations
from app.services.reliability_pattern_mining import build_prompt_pattern_hash, get_pattern_risk
from app.services.reliability_metrics import (
    METRIC_QUALITY_PASS_RATE,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    latest_project_reliability_metrics,
)

SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_CRITICAL = "critical"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _severity_rank(value: str) -> int:
    if value == SEVERITY_CRITICAL:
        return 3
    if value == SEVERITY_WARNING:
        return 2
    return 1


def _create_recommendation(
    db: Session,
    *,
    project_id: UUID,
    recommendation_type: str,
    severity: str,
    title: str,
    description: str,
    evidence_json: dict,
) -> ReliabilityRecommendation:
    item = ReliabilityRecommendation(
        project_id=project_id,
        recommendation_type=recommendation_type,
        severity=severity,
        title=title,
        description=description,
        evidence_json=evidence_json,
    )
    db.add(item)
    db.flush()
    return item


def generate_recommendations(db: Session, project_id: UUID) -> list[ReliabilityRecommendation]:
    db.execute(
        delete(ReliabilityRecommendation).where(ReliabilityRecommendation.project_id == project_id)
    )
    project = db.get(Project, project_id)
    if project is None:
        return []

    latest_metrics = latest_project_reliability_metrics(db, project_id=project_id)
    latest_deployment = db.scalar(
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .options(
            selectinload(Deployment.risk_score),
            selectinload(Deployment.prompt_version),
            selectinload(Deployment.model_version),
        )
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    )
    latest_simulation = db.scalar(
        select(DeploymentSimulation)
        .where(DeploymentSimulation.project_id == project_id)
        .order_by(desc(DeploymentSimulation.created_at), desc(DeploymentSimulation.id))
    )
    guardrail_policies = db.scalars(
        select(GuardrailPolicy)
        .where(GuardrailPolicy.project_id == project_id, GuardrailPolicy.is_active.is_(True))
        .order_by(GuardrailPolicy.created_at.asc(), GuardrailPolicy.id.asc())
    ).all()
    policy_actions = {policy.policy_type: str(policy.config_json.get("action", "unknown")) for policy in guardrail_policies}

    lookback_start = _utc_now() - timedelta(hours=24)
    top_guardrail = db.execute(
        select(
            GuardrailPolicy.policy_type,
            func.count(GuardrailRuntimeEvent.id).label("trigger_count"),
        )
        .join(GuardrailRuntimeEvent, GuardrailRuntimeEvent.policy_id == GuardrailPolicy.id)
        .where(
            GuardrailPolicy.project_id == project_id,
            GuardrailRuntimeEvent.created_at >= lookback_start,
        )
        .group_by(GuardrailPolicy.policy_type)
        .order_by(desc("trigger_count"), GuardrailPolicy.policy_type.asc())
        .limit(1)
    ).first()

    items: list[ReliabilityRecommendation] = []
    pattern_context_model_family = None
    pattern_context_prompt_hash = None
    if latest_deployment is not None:
        pattern_context_model_family = (
            latest_deployment.model_version.model_family
            if latest_deployment.model_version is not None
            else None
        )
        pattern_context_prompt_hash = build_prompt_pattern_hash(
            str(latest_deployment.prompt_version_id) if latest_deployment.prompt_version_id is not None else None
        )
    pattern_risk = get_pattern_risk(
        db,
        model_family=pattern_context_model_family,
        prompt_pattern_hash=pattern_context_prompt_hash,
    )

    structured_validity = latest_metrics.get(METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE)
    if structured_validity is not None and structured_validity.value_number < 0.9:
        existing_action = policy_actions.get("structured_output")
        if existing_action == "retry":
            title = "Tighten structured output retry guardrail"
            description = (
                "Structured output validity is below target. Review the structured_output retry policy, "
                "schema contract, and representative failing traces before expanding traffic."
            )
        else:
            title = "Add structured output retry guardrail"
            description = (
                "Structured output validity is below target. Add a structured_output retry guardrail "
                "before promoting more production traffic."
            )
        items.append(
            _create_recommendation(
                db,
                project_id=project_id,
                recommendation_type="guardrail_recommendation",
                severity=SEVERITY_WARNING,
                title=title,
                description=description,
                evidence_json={
                    "metric_name": METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
                    "observed_value": round(structured_validity.value_number, 4),
                    "threshold": 0.9,
                    "policy_type": "structured_output",
                    "recommended_action": "retry",
                    "current_action": existing_action,
                    "related_incident_types": ["structured_output_validity_drop"],
                    "related_cause_types": ["prompt_concentration", "model_concentration", "error_cluster"],
                },
            )
        )

    quality_pass_rate = latest_metrics.get(METRIC_QUALITY_PASS_RATE)
    if quality_pass_rate is not None and quality_pass_rate.value_number < 0.92:
        items.append(
            _create_recommendation(
                db,
                project_id=project_id,
                recommendation_type="evaluation_recommendation",
                severity=SEVERITY_WARNING,
                title="Inspect evaluation failures before rollout",
                description=(
                    "Recent quality pass rate is below target. Review representative failing traces and "
                    "the evaluation breakdown before widening the current rollout."
                ),
                evidence_json={
                    "metric_name": METRIC_QUALITY_PASS_RATE,
                    "observed_value": round(quality_pass_rate.value_number, 4),
                    "threshold": 0.92,
                    "related_incident_types": ["quality_drop", "structured_output_validity_drop"],
                    "related_cause_types": ["error_cluster", "prompt_concentration"],
                },
            )
        )

    if latest_deployment is not None and latest_deployment.risk_score is not None:
        risk_score = float(latest_deployment.risk_score.risk_score)
        risk_level = latest_deployment.risk_score.risk_level
        signals = latest_deployment.risk_score.analysis_json.get("signals", [])
        dominant_signal = (
            sorted(
                signals,
                key=lambda item: (float(item.get("weighted_value", 0.0)), str(item.get("signal_name", ""))),
                reverse=True,
            )[0]
            if signals
            else None
        )
        if risk_level in {"medium", "high"}:
            items.append(
                _create_recommendation(
                    db,
                    project_id=project_id,
                    recommendation_type="deployment_regression",
                    severity=SEVERITY_CRITICAL if risk_level == "high" else SEVERITY_WARNING,
                    title="Pause or narrow the latest deployment",
                    description=(
                        "Deployment risk is elevated. Inspect the latest rollout, linked regressions, "
                        "and representative failing traces before expanding traffic."
                    ),
                    evidence_json={
                        "deployment_id": str(latest_deployment.id),
                        "risk_score": round(risk_score, 4),
                        "risk_level": risk_level,
                        "signal_name": dominant_signal.get("signal_name") if dominant_signal else None,
                        "metric_name": (
                            "latency_ms"
                            if dominant_signal and dominant_signal.get("signal_name") == "latency_delta"
                            else (
                                METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE
                                if dominant_signal and dominant_signal.get("signal_name") == "structured_output_delta"
                                else "deployment_risk"
                            )
                        ),
                        "related_incident_types": [
                            "structured_output_validity_drop",
                            "latency_spike",
                            "error_rate_spike",
                        ],
                        "related_cause_types": ["prompt_concentration", "model_concentration", "latency_change"],
                    },
                )
            )

        if dominant_signal is not None and dominant_signal.get("signal_name") == "latency_delta":
            items.append(
                _create_recommendation(
                    db,
                    project_id=project_id,
                    recommendation_type="latency_mitigation",
                    severity=SEVERITY_WARNING,
                    title="Review latency budget before expanding rollout",
                    description=(
                        "Deployment risk analysis shows a latency jump. Compare provider latency, retrieval "
                        "latency, and timeout configuration against the previous stable window."
                    ),
                    evidence_json={
                        "deployment_id": str(latest_deployment.id),
                        "metric_name": "latency_ms",
                        "signal_name": "latency_delta",
                        "weighted_value": dominant_signal.get("weighted_value"),
                        "related_incident_types": ["latency_spike"],
                        "related_cause_types": ["latency_change", "retrieval_shift"],
                    },
                )
            )

    if latest_simulation is not None:
        predicted_failure_rate = (
            float(latest_simulation.predicted_failure_rate)
            if latest_simulation.predicted_failure_rate is not None
            else None
        )
        predicted_latency_ms = (
            float(latest_simulation.predicted_latency_ms)
            if latest_simulation.predicted_latency_ms is not None
            else None
        )
        if latest_simulation.risk_level in {"medium", "high"} or (
            predicted_failure_rate is not None and predicted_failure_rate >= 0.2
        ):
            items.append(
                _create_recommendation(
                    db,
                    project_id=project_id,
                    recommendation_type="simulation_risk",
                    severity=SEVERITY_CRITICAL if latest_simulation.risk_level == "high" else SEVERITY_WARNING,
                    title="Do not promote the simulated configuration yet",
                    description=(
                        "Simulation predicts elevated failure pressure. Hold promotion until the prompt or "
                        "model change is re-tested against recent representative traces."
                    ),
                    evidence_json={
                        "simulation_id": str(latest_simulation.id),
                        "predicted_failure_rate": predicted_failure_rate,
                        "predicted_latency_ms": predicted_latency_ms,
                        "risk_level": latest_simulation.risk_level,
                        "metric_name": "predicted_failure_rate",
                        "related_incident_types": ["structured_output_validity_drop", "latency_spike"],
                        "related_cause_types": ["prompt_concentration", "model_concentration", "latency_change"],
                    },
                )
            )

    if top_guardrail is not None and int(top_guardrail.trigger_count or 0) >= 5:
        items.append(
            _create_recommendation(
                db,
                project_id=project_id,
                recommendation_type="guardrail_pattern",
                severity=SEVERITY_WARNING,
                title=f"Investigate repeated {top_guardrail.policy_type} guardrail triggers",
                description=(
                    "Runtime guardrails are firing frequently. Review the protected traffic slice and the "
                    "underlying prompt, model, or budget thresholds instead of relying on repeated retries."
                ),
                evidence_json={
                    "policy_type": top_guardrail.policy_type,
                    "trigger_count_last_24h": int(top_guardrail.trigger_count or 0),
                    "metric_name": (
                        METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE
                        if top_guardrail.policy_type == "structured_output"
                        else "guardrail_trigger_rate"
                    ),
                    "related_incident_types": ["structured_output_validity_drop", "latency_spike"],
                    "related_cause_types": ["error_cluster", "latency_change"],
                },
            )
        )

    graph_recommendations = get_graph_guardrail_recommendations(
        db,
        organization_ids=[project.organization_id],
    )
    for recommendation in recommend_guardrails_from_patterns(
        pattern_risk=pattern_risk,
        graph_recommendations=graph_recommendations,
    ):
        items.append(
            _create_recommendation(
                db,
                project_id=project_id,
                recommendation_type="guardrail_intelligence",
                severity=SEVERITY_WARNING,
                title=str(recommendation["title"]),
                description=str(recommendation["description"]),
                evidence_json={
                    "policy_type": recommendation["policy_type"],
                    "recommended_action": recommendation["recommended_action"],
                    "failure_probability": recommendation["failure_probability"],
                    "pattern_risk": pattern_risk,
                    "related_cause_types": ["cross_project_pattern"],
                    "related_incident_types": ["latency_spike", "quality_drop"],
                },
            )
        )

    items.sort(
        key=lambda item: (
            _severity_rank(item.severity),
            item.title,
            str(item.id),
        ),
        reverse=True,
    )
    return items


def get_active_recommendations(db: Session, project_id: UUID) -> list[ReliabilityRecommendation]:
    items = db.scalars(
        select(ReliabilityRecommendation)
        .where(ReliabilityRecommendation.project_id == project_id)
        .order_by(desc(ReliabilityRecommendation.created_at), ReliabilityRecommendation.title.asc())
    ).all()
    return sorted(
        items,
        key=lambda item: (
            _severity_rank(item.severity),
            item.title,
            str(item.id),
        ),
        reverse=True,
    )
