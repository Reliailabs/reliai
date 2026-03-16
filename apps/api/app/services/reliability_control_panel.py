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
from app.models.project import Project
from app.models.reliability_action_log import ReliabilityActionLog
from app.models.trace import Trace
from app.services.environments import get_default_environment, get_environment_by_name, normalize_environment_name
from app.services.organization_guardrails import guardrail_compliance_for_project
from app.services.reliability_graph import (
    get_graph_guardrail_recommendations,
    get_high_risk_patterns,
    get_model_failure_graph,
)
from app.services.trace_query_router import query_recent_traces
from app.services.trace_query_router import aggregate_trace_metrics
from app.services.trace_query_router import count_distinct_services
from app.services.trace_warehouse import TraceWarehouseAggregateQuery, TraceWarehouseQuery
from app.services.global_metrics import (
    METRIC_AVERAGE_LATENCY_MS,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    METRIC_SUCCESS_RATE,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _reliability_score(*, deployment_risk_level: str | None, incident_count: int, guardrail_triggers: int) -> int:
    score = 100
    if deployment_risk_level == "high":
        score -= 25
    elif deployment_risk_level == "medium":
        score -= 12
    score -= min(40, incident_count * 12)
    score -= min(25, guardrail_triggers)
    return max(0, score)


def get_project_reliability_control_panel(db: Session, project_id: UUID, environment: str | None = None) -> dict:
    now = _utc_now()
    last_24h = now - timedelta(hours=24)
    normalized_environment = normalize_environment_name(environment) if environment is not None else None
    project = db.get(Project, project_id)
    if project is None:
        raise ValueError("Project not found")
    environment_record = (
        get_environment_by_name(db, project_id=project_id, name=normalized_environment)
        if normalized_environment is not None
        else get_default_environment(db, project_id=project_id)
    )

    latest_deployment_statement = select(Deployment).where(Deployment.project_id == project_id)
    if normalized_environment is not None:
        latest_deployment_statement = latest_deployment_statement.where(Deployment.environment == normalized_environment)
    latest_deployment = db.scalar(
        latest_deployment_statement
        .options(
            selectinload(Deployment.project),
            selectinload(Deployment.risk_score),
            selectinload(Deployment.model_version),
        )
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
    )

    recent_incident_statement = select(Incident).where(Incident.project_id == project_id)
    if normalized_environment is not None:
        recent_incident_statement = recent_incident_statement.where(Incident.environment_ref.has(name=normalized_environment))
    recent_incidents = db.scalars(
        recent_incident_statement
        .order_by(desc(Incident.started_at), desc(Incident.id))
        .limit(5)
    ).all()
    incident_rate_last_24h = int(
        db.scalar(
            select(func.count(Incident.id)).where(
                Incident.project_id == project_id,
                Incident.environment_ref.has(name=normalized_environment) if normalized_environment is not None else True,
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
                GuardrailPolicy.environment_ref.has(name=normalized_environment) if normalized_environment is not None else True,
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
            GuardrailPolicy.environment_ref.has(name=normalized_environment) if normalized_environment is not None else True,
            GuardrailRuntimeEvent.created_at >= last_24h,
        )
        .group_by(GuardrailPolicy.policy_type)
        .order_by(desc("trigger_count"), GuardrailPolicy.policy_type.asc())
        .limit(1)
    ).first()

    warehouse_rows = query_recent_traces(
        TraceWarehouseQuery(
            organization_id=project.organization_id,
            project_id=project_id,
            environment_id=environment_record.id if environment_record is not None else None,
            window_start=last_24h,
            window_end=now,
            limit=5000,
        )
    )
    trace_summary = aggregate_trace_metrics(
        TraceWarehouseAggregateQuery(
            organization_id=project.organization_id,
            project_id=project_id,
            environment_id=environment_record.id if environment_record is not None else None,
            window_start=last_24h,
            window_end=now,
        )
    )
    guardrail_activity_counts: dict[str, int] = {}
    for row in warehouse_rows:
        if row.guardrail_policy:
            guardrail_activity_counts[row.guardrail_policy] = guardrail_activity_counts.get(row.guardrail_policy, 0) + 1
    guardrail_activity = [
        {
            "policy_type": policy_type,
            "trigger_count": trigger_count,
        }
        for policy_type, trigger_count in sorted(
            guardrail_activity_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]

    recent_deployments_statement = select(Deployment).where(Deployment.project_id == project_id)
    if normalized_environment is not None:
        recent_deployments_statement = recent_deployments_statement.where(Deployment.environment == normalized_environment)
    recent_deployments = db.scalars(
        recent_deployments_statement
        .options(selectinload(Deployment.risk_score))
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
        .limit(5)
    ).all()

    latest_simulation = db.scalar(
        select(DeploymentSimulation)
        .where(
            DeploymentSimulation.project_id == project_id,
            DeploymentSimulation.environment_ref.has(name=normalized_environment) if normalized_environment is not None else True,
        )
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
            .where(
                Trace.project_id == project_id,
                Trace.environment == normalized_environment if normalized_environment is not None else True,
            )
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

    graph_high_risk_patterns = get_high_risk_patterns(
        db,
        organization_ids=[latest_deployment.project.organization_id] if latest_deployment is not None and latest_deployment.project is not None else None,
        project_id=project_id,
        limit=4,
    )
    recommended_guardrails = get_graph_guardrail_recommendations(
        db,
        organization_ids=[latest_deployment.project.organization_id] if latest_deployment is not None and latest_deployment.project is not None else None,
        project_id=project_id,
    )
    model_failure_signals = get_model_failure_graph(
        db,
        model_family=current_model_name,
        organization_ids=[latest_deployment.project.organization_id] if latest_deployment is not None and latest_deployment.project is not None else None,
        project_id=project_id,
    )

    high_risk_patterns = [
        {
            "pattern": item["pattern"],
            "risk_level": item["risk_level"],
            "trace_count": item["traces"],
            "confidence": item["confidence"],
        }
        for item in graph_high_risk_patterns
    ]
    reliability_score = _reliability_score(
        deployment_risk_level=(
            latest_deployment.risk_score.risk_level
            if latest_deployment is not None and latest_deployment.risk_score is not None
            else None
        ),
        incident_count=incident_rate_last_24h,
        guardrail_triggers=guardrail_trigger_rate_last_24h,
    )
    traces_last_24h = int(trace_summary["trace_count"])
    traces_per_second = round(traces_last_24h / 86400, 1) if traces_last_24h > 0 else 0.0
    active_services = count_distinct_services(
        organization_id=project.organization_id,
        project_id=project_id,
        environment_id=environment_record.id if environment_record is not None else None,
        window_start=last_24h,
        window_end=now,
    )

    return {
        "reliability_score": reliability_score,
        "traces_last_24h": traces_last_24h,
        "traces_per_second": traces_per_second,
        "active_incidents": sum(1 for incident in recent_incidents if incident.status != "resolved"),
        "active_services": active_services,
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
        "guardrail_activity": guardrail_activity,
        "guardrail_compliance": guardrail_compliance_for_project(
            db,
            organization_id=project.organization_id,
            project_id=project_id,
            environment_id=environment_record.id if environment_record is not None else None,
        ),
        "model_reliability": {
            "current_model": current_model_name,
            "success_rate": model_metrics["success_rate"],
            "average_latency": model_metrics["average_latency"],
            "structured_output_validity": model_metrics["structured_output_validity"],
        },
        "high_risk_patterns": high_risk_patterns,
        "graph_high_risk_patterns": high_risk_patterns,
        "recommended_guardrails": [
            {
                "policy_type": item["policy_type"],
                "recommended_action": item["recommended_action"],
                "title": item["title"],
                "confidence": item["confidence"],
                "model_family": item.get("model_family"),
            }
            for item in recommended_guardrails
        ],
        "model_failure_signals": [
            {
                "pattern": item["pattern"],
                "risk_level": item["risk_level"],
                "confidence": item["confidence"],
            }
            for item in model_failure_signals["patterns"][:3]
        ],
        "recent_deployments": [
            {
                "deployment_id": deployment.id,
                "deployed_at": deployment.deployed_at,
                "environment": deployment.environment,
                "risk_level": deployment.risk_score.risk_level if deployment.risk_score is not None else None,
                "risk_score": float(deployment.risk_score.risk_score) if deployment.risk_score is not None else None,
            }
            for deployment in recent_deployments
        ],
        "automatic_actions": {
            "recent_actions": [
                {
                    "action_id": item.id,
                    "action_type": item.action_type,
                    "target": item.target,
                    "status": item.status,
                    "created_at": item.created_at,
                }
                for item in db.scalars(
                    select(ReliabilityActionLog)
                    .where(ReliabilityActionLog.project_id == project_id)
                    .order_by(desc(ReliabilityActionLog.created_at), desc(ReliabilityActionLog.id))
                    .limit(5)
                ).all()
            ]
        },
    }
