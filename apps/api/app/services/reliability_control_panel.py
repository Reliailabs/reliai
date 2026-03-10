from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_simulation import DeploymentSimulation
from app.models.global_model_reliability import GlobalModelReliability
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.trace import Trace
from app.services.global_metrics import (
    METRIC_AVERAGE_LATENCY_MS,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    METRIC_SUCCESS_RATE,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_project_reliability_control_panel(db: Session, project_id: UUID) -> dict:
    now = _utc_now()
    last_24h = now - timedelta(hours=24)

    latest_deployment = db.scalar(
        select(Deployment)
        .where(Deployment.project_id == project_id)
        .options(selectinload(Deployment.risk_score), selectinload(Deployment.model_version))
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    )

    recent_incidents = db.scalars(
        select(Incident)
        .where(Incident.project_id == project_id)
        .order_by(desc(Incident.started_at), desc(Incident.id))
        .limit(5)
    ).all()
    incident_rate_last_24h = int(
        db.scalar(
            select(func.count(Incident.id)).where(
                Incident.project_id == project_id,
                Incident.started_at >= last_24h,
            )
        )
        or 0
    )

    guardrail_trigger_rate_last_24h = int(
        db.scalar(
            select(func.count(GuardrailRuntimeEvent.id))
            .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
            .where(
                GuardrailPolicy.project_id == project_id,
                GuardrailRuntimeEvent.created_at >= last_24h,
            )
        )
        or 0
    )
    top_policy_row = db.execute(
        select(
            GuardrailPolicy.policy_type,
            func.count(GuardrailRuntimeEvent.id).label("trigger_count"),
        )
        .join(GuardrailRuntimeEvent, GuardrailRuntimeEvent.policy_id == GuardrailPolicy.id)
        .where(
            GuardrailPolicy.project_id == project_id,
            GuardrailRuntimeEvent.created_at >= last_24h,
        )
        .group_by(GuardrailPolicy.policy_type)
        .order_by(desc("trigger_count"), GuardrailPolicy.policy_type.asc())
        .limit(1)
    ).first()

    latest_simulation = db.scalar(
        select(DeploymentSimulation)
        .where(DeploymentSimulation.project_id == project_id)
        .order_by(desc(DeploymentSimulation.created_at), desc(DeploymentSimulation.id))
    )

    current_model_name: str | None = None
    current_model_provider: str | None = None
    if latest_deployment is not None and latest_deployment.model_version is not None:
        current_model_name = latest_deployment.model_version.model_name
        current_model_provider = latest_deployment.model_version.provider or "unknown"
    else:
        latest_trace = db.scalar(
            select(Trace)
            .where(Trace.project_id == project_id)
            .order_by(desc(Trace.created_at), desc(Trace.id))
        )
        if latest_trace is not None:
            current_model_name = latest_trace.model_name
            current_model_provider = latest_trace.model_provider or "unknown"

    model_metrics: dict[str, float | None] = {
        "success_rate": None,
        "average_latency": None,
        "structured_output_validity": None,
    }
    if current_model_name is not None:
        rows = db.scalars(
            select(GlobalModelReliability).where(
                GlobalModelReliability.provider == (current_model_provider or "unknown"),
                GlobalModelReliability.model_name == current_model_name,
                GlobalModelReliability.metric_name.in_(
                    [
                        METRIC_SUCCESS_RATE,
                        METRIC_AVERAGE_LATENCY_MS,
                        METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
                    ]
                ),
            )
        ).all()
        for row in rows:
            if row.metric_name == METRIC_SUCCESS_RATE:
                model_metrics["success_rate"] = float(row.metric_value)
            elif row.metric_name == METRIC_AVERAGE_LATENCY_MS:
                model_metrics["average_latency"] = float(row.metric_value)
            elif row.metric_name == METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE:
                model_metrics["structured_output_validity"] = float(row.metric_value)

    return {
        "deployment_risk": {
            "latest_deployment_id": str(latest_deployment.id) if latest_deployment is not None else None,
            "deployed_at": latest_deployment.deployed_at if latest_deployment is not None else None,
            "risk_score": (
                float(latest_deployment.risk_score.risk_score)
                if latest_deployment is not None and latest_deployment.risk_score is not None
                else None
            ),
            "risk_level": (
                latest_deployment.risk_score.risk_level
                if latest_deployment is not None and latest_deployment.risk_score is not None
                else None
            ),
        },
        "simulation": {
            "latest_simulation_id": str(latest_simulation.id) if latest_simulation is not None else None,
            "predicted_failure_rate": (
                float(latest_simulation.predicted_failure_rate)
                if latest_simulation is not None and latest_simulation.predicted_failure_rate is not None
                else None
            ),
            "predicted_latency": (
                float(latest_simulation.predicted_latency_ms)
                if latest_simulation is not None and latest_simulation.predicted_latency_ms is not None
                else None
            ),
            "risk_level": latest_simulation.risk_level if latest_simulation is not None else None,
            "created_at": latest_simulation.created_at if latest_simulation is not None else None,
        },
        "incidents": {
            "recent_incidents": [
                {
                    "incident_id": incident.id,
                    "title": incident.title,
                    "severity": incident.severity,
                    "status": incident.status,
                    "started_at": incident.started_at,
                }
                for incident in recent_incidents
            ],
            "incident_rate_last_24h": incident_rate_last_24h,
        },
        "guardrails": {
            "trigger_rate_last_24h": guardrail_trigger_rate_last_24h,
            "top_triggered_policy": top_policy_row.policy_type if top_policy_row is not None else None,
        },
        "model_reliability": {
            "current_model": current_model_name,
            "success_rate": model_metrics["success_rate"],
            "average_latency": model_metrics["average_latency"],
            "structured_output_validity": model_metrics["structured_output_validity"],
        },
    }
