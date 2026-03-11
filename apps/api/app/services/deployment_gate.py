from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_simulation import DeploymentSimulation
from app.models.guardrail_policy import GuardrailPolicy
from app.models.incident import Incident
from app.models.project import Project
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.services.reliability_graph import get_graph_guardrail_recommendations, get_high_risk_patterns
from app.services.trace_query_router import query_hourly_metrics

DECISION_ALLOW = "ALLOW"
DECISION_WARN = "WARN"
DECISION_BLOCK = "BLOCK"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _decision_for_score(score: int) -> str:
    if score >= 70:
        return DECISION_BLOCK
    if score >= 40:
        return DECISION_WARN
    return DECISION_ALLOW


def evaluate_deployment(db: Session, project_id: UUID, deployment_id: UUID) -> dict:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    deployment = db.scalar(
        select(Deployment)
        .options(
            selectinload(Deployment.project),
            selectinload(Deployment.prompt_version),
            selectinload(Deployment.model_version),
            selectinload(Deployment.risk_score),
        )
        .where(Deployment.id == deployment_id, Deployment.project_id == project_id)
    )
    if deployment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment not found")

    latest_simulation = db.scalar(
        select(DeploymentSimulation)
        .where(
            DeploymentSimulation.project_id == project_id,
            DeploymentSimulation.environment_id == deployment.environment_id,
            DeploymentSimulation.prompt_version_id == deployment.prompt_version_id
            if deployment.prompt_version_id is not None
            else True,
            DeploymentSimulation.model_version_id == deployment.model_version_id
            if deployment.model_version_id is not None
            else True,
        )
        .order_by(DeploymentSimulation.created_at.desc(), DeploymentSimulation.id.desc())
    )

    risk_record = deployment.risk_score or calculate_deployment_risk(db, deployment_id=deployment.id)
    base_risk = float(risk_record.risk_score)
    simulation_risk = float(latest_simulation.predicted_failure_rate) if latest_simulation and latest_simulation.predicted_failure_rate is not None else 0.0
    latency_projection = float(latest_simulation.predicted_latency_ms) if latest_simulation and latest_simulation.predicted_latency_ms is not None else 0.0
    latency_risk = min(0.2, latency_projection / 10000.0)
    cost_projection = 0.0
    if deployment.metadata_json is not None:
        raw_cost = deployment.metadata_json.get("projected_cost_usd") or deployment.metadata_json.get("cost_projection_usd")
        if isinstance(raw_cost, (int, float)):
            cost_projection = float(raw_cost)
    cost_risk = min(0.15, cost_projection / 100.0)

    high_risk_patterns = get_high_risk_patterns(
        db,
        organization_ids=[project.organization_id],
        project_id=project_id,
        limit=5,
    )
    pattern_risk = min(0.25, sum(float(item["confidence"]) for item in high_risk_patterns[:3]) / 3.0) if high_risk_patterns else 0.0

    recent_incidents = int(
        db.scalar(
            select(func.count(Incident.id)).where(
                Incident.project_id == project_id,
                Incident.environment_id == deployment.environment_id,
                Incident.started_at >= _utc_now() - timedelta(days=7),
            )
        )
        or 0
    )
    incident_risk = min(0.2, recent_incidents * 0.05)

    active_guardrails = {
        row.policy_type
        for row in db.scalars(
                select(GuardrailPolicy).where(
                    GuardrailPolicy.project_id == project_id,
                    GuardrailPolicy.environment_id == deployment.environment_id,
                    GuardrailPolicy.is_active.is_(True),
                )
            ).all()
    }
    recommended_guardrails = get_graph_guardrail_recommendations(
        db,
        organization_ids=[project.organization_id],
        project_id=project_id,
    )
    recommended_guardrail_types = [str(item["policy_type"]) for item in recommended_guardrails]
    missing_recommended_guardrails = [item for item in recommended_guardrail_types if item not in active_guardrails]
    guardrail_gap_risk = min(0.2, len(missing_recommended_guardrails) * 0.08)

    hourly_rows = query_hourly_metrics(
        project_id=project_id,
        environment_id=deployment.environment_id,
        start_time=_utc_now() - timedelta(days=1),
        end_time=_utc_now(),
    )
    warehouse_cost_risk = 0.0
    if hourly_rows:
        avg_cost = sum(row.cost_usd for row in hourly_rows) / max(1, len(hourly_rows))
        warehouse_cost_risk = min(0.1, avg_cost / 10.0)

    total_risk = min(
        1.0,
        base_risk
        + simulation_risk
        + latency_risk
        + cost_risk
        + warehouse_cost_risk
        + pattern_risk
        + incident_risk
        + guardrail_gap_risk,
    )
    risk_score = int(round(total_risk * 100))

    explanations: list[str] = []
    if base_risk >= 0.35:
        explanations.append(f"deployment risk engine scored this change at {base_risk:.2f}")
    if simulation_risk >= 0.25:
        explanations.append("deployment simulation predicts elevated failure risk")
    if latency_risk >= 0.1:
        explanations.append("high latency regression risk")
    if cost_risk >= 0.08 or warehouse_cost_risk >= 0.05:
        explanations.append("token cost projection is elevated")
    if pattern_risk >= 0.1:
        explanations.append("reliability graph shows historical instability for similar changes")
    if recent_incidents > 0:
        explanations.append(f"{recent_incidents} recent incidents raise rollout risk")
    for policy_type in missing_recommended_guardrails[:2]:
        explanations.append(f"missing {policy_type} guardrail coverage")

    if not explanations:
        explanations.append("no elevated safety signals detected in current deployment checks")

    return {
        "decision": _decision_for_score(risk_score),
        "risk_score": risk_score,
        "explanations": explanations,
        "recommended_guardrails": missing_recommended_guardrails[:4] or recommended_guardrail_types[:4],
    }
