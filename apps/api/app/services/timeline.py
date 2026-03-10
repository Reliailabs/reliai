from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.deployment import Deployment
from app.models.deployment_simulation import DeploymentSimulation
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.guardrail_event import GuardrailEvent
from app.models.guardrail_policy import GuardrailPolicy
from app.models.incident import Incident
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace


@dataclass(frozen=True)
class TimelineEvent:
    timestamp: datetime
    event_type: str
    title: str
    summary: str
    severity: str | None
    metadata: dict | None


def _format_decimal(value: Decimal | None) -> str:
    if value is None:
        return "n/a"
    return format(value, "f")


def _incident_event(incident: Incident) -> TimelineEvent:
    summary = incident.summary_json or {}
    metric_name = summary.get("metric_name")
    delta_percent = summary.get("delta_percent")
    detail = f"{incident.incident_type} · {incident.status}"
    if metric_name:
        detail = f"{detail} · {metric_name}"
    if delta_percent is not None:
        detail = f"{detail} · Δ {delta_percent}"
    return TimelineEvent(
        timestamp=incident.started_at,
        event_type="incident",
        title=incident.title,
        summary=detail,
        severity=incident.severity,
        metadata={
            "incident_id": str(incident.id),
            "project_id": str(incident.project_id),
            "path": f"/incidents/{incident.id}",
            "incident_type": incident.incident_type,
            "status": incident.status,
        },
    )


def _deployment_title(deployment: Deployment) -> str:
    prompt = deployment.prompt_version.version if deployment.prompt_version is not None else None
    model = deployment.model_version.model_name if deployment.model_version is not None else None
    if prompt and model:
        return f"Deployment: {prompt} on {model}"
    if prompt:
        return f"Deployment: prompt {prompt}"
    if model:
        return f"Deployment: {model}"
    return f"Deployment to {deployment.environment}"


def _deployment_summary(deployment: Deployment) -> str:
    parts = [deployment.environment]
    if deployment.deployed_by:
        parts.append(f"by {deployment.deployed_by}")
    strategy = (deployment.metadata_json or {}).get("deployment_strategy")
    if strategy:
        parts.append(str(strategy))
    return " · ".join(parts)


def _deployment_event(deployment: Deployment) -> TimelineEvent:
    return TimelineEvent(
        timestamp=deployment.deployed_at,
        event_type="deployment",
        title=_deployment_title(deployment),
        summary=_deployment_summary(deployment),
        severity="info",
        metadata={
            "deployment_id": str(deployment.id),
            "project_id": str(deployment.project_id),
            "path": f"/deployments/{deployment.id}",
            "prompt_version_id": str(deployment.prompt_version_id) if deployment.prompt_version_id else None,
            "model_version_id": str(deployment.model_version_id) if deployment.model_version_id else None,
        },
    )


def _deployment_risk_event(item: DeploymentRiskScore) -> TimelineEvent:
    deployment = item.deployment
    signals = (item.analysis_json or {}).get("signals", [])
    active_signals = [
        signal["signal_name"].replace("_", " ")
        for signal in signals
        if signal.get("weighted_value", 0) > 0
    ][:2]
    title = _deployment_title(deployment)
    summary = f"Risk {item.risk_level.upper()}"
    if active_signals:
        summary = f"{summary} · " + " · ".join(active_signals)
    return TimelineEvent(
        timestamp=item.created_at,
        event_type="deployment_risk_evaluated",
        title=f"Deployment Risk: {title.removeprefix('Deployment: ')}",
        summary=summary,
        severity=item.risk_level,
        metadata={
            "deployment_risk_score_id": str(item.id),
            "deployment_id": str(deployment.id),
            "project_id": str(deployment.project_id),
            "path": f"/deployments/{deployment.id}",
            "risk_score": float(item.risk_score),
            "risk_level": item.risk_level,
        },
    )


def _simulation_link_path(item: DeploymentSimulation) -> str:
    if item.prompt_version_id is not None:
        return f"/prompt-versions/{item.prompt_version_id}?projectId={item.project_id}"
    if item.model_version_id is not None:
        return f"/model-versions/{item.model_version_id}?projectId={item.project_id}"
    return f"/projects/{item.project_id}/deployments"


def _deployment_simulation_title(item: DeploymentSimulation) -> str:
    prompt = item.prompt_version.version if item.prompt_version is not None else None
    model = item.model_version.model_name if item.model_version is not None else None
    if prompt and model:
        return f"Deployment Simulation: {prompt} on {model}"
    if prompt:
        return f"Deployment Simulation: prompt {prompt}"
    if model:
        return f"Deployment Simulation: {model}"
    return "Deployment Simulation"


def _deployment_simulation_event(item: DeploymentSimulation) -> TimelineEvent:
    analysis = item.analysis_json or {}
    signals = analysis.get("signals", [])
    top_signals = [
        signal["signal_name"].replace("_", " ")
        for signal in signals
        if signal.get("value") not in (None, 0, 0.0)
    ][:2]
    summary = f"Risk {item.risk_level.upper()}" if item.risk_level is not None else "Simulation queued"
    if top_signals:
        summary = f"{summary} · " + " · ".join(top_signals)
    return TimelineEvent(
        timestamp=item.created_at,
        event_type="deployment_simulation_completed",
        title=_deployment_simulation_title(item),
        summary=summary,
        severity=item.risk_level,
        metadata={
            "deployment_simulation_id": str(item.id),
            "project_id": str(item.project_id),
            "prompt_version_id": str(item.prompt_version_id) if item.prompt_version_id is not None else None,
            "model_version_id": str(item.model_version_id) if item.model_version_id is not None else None,
            "path": _simulation_link_path(item),
            "trace_sample_size": item.trace_sample_size,
        },
    )


def _guardrail_severity(action_taken: str) -> str:
    if action_taken == "block":
        return "high"
    if action_taken == "fallback_model":
        return "medium"
    if action_taken == "retry":
        return "medium"
    return "low"


def _guardrail_event(event: GuardrailEvent) -> TimelineEvent:
    trace = event.trace
    policy = event.policy
    summary_parts = [f"{policy.policy_type} · {event.action_taken}"]
    reason = (event.metadata_json or {}).get("reason")
    if reason:
        summary_parts.append(str(reason))
    return TimelineEvent(
        timestamp=event.created_at,
        event_type="guardrail",
        title=f"Guardrail {event.action_taken} on trace {trace.request_id}",
        summary=" · ".join(summary_parts),
        severity=_guardrail_severity(event.action_taken),
        metadata={
            "guardrail_event_id": str(event.id),
            "trace_id": str(trace.id),
            "trace_request_id": trace.request_id,
            "policy_id": str(policy.id),
            "policy_type": policy.policy_type,
            "action_taken": event.action_taken,
            "path": f"/traces/{trace.id}",
        },
    )


def _guardrail_runtime_event(event: GuardrailRuntimeEvent) -> TimelineEvent:
    policy = event.policy
    summary_parts = [f"{policy.policy_type} · {event.action_taken}"]
    if event.provider_model:
        summary_parts.append(event.provider_model)
    if event.latency_ms is not None:
        summary_parts.append(f"{event.latency_ms}ms")
    reason = (event.metadata_json or {}).get("reason")
    if reason:
        summary_parts.append(str(reason))
    return TimelineEvent(
        timestamp=event.created_at,
        event_type="guardrail_runtime_enforced",
        title=f"Runtime guardrail {event.action_taken}",
        summary=" · ".join(summary_parts),
        severity=_guardrail_severity(event.action_taken),
        metadata={
            "guardrail_runtime_event_id": str(event.id),
            "policy_id": str(policy.id),
            "policy_type": policy.policy_type,
            "action_taken": event.action_taken,
            "provider_model": event.provider_model,
            "trace_id": str(event.trace_id),
            "path": None,
        },
    )


def _regression_severity(snapshot: RegressionSnapshot) -> str:
    percent = abs(snapshot.delta_percent or Decimal("0"))
    if percent >= Decimal("1.0"):
        return "high"
    if percent >= Decimal("0.5"):
        return "medium"
    return "low"


def _regression_event(snapshot: RegressionSnapshot) -> TimelineEvent:
    return TimelineEvent(
        timestamp=snapshot.detected_at,
        event_type="regression",
        title=f"Regression detected: {snapshot.metric_name}",
        summary=(
            f"{snapshot.scope_type} {snapshot.scope_id} · "
            f"{_format_decimal(snapshot.baseline_value)} -> {_format_decimal(snapshot.current_value)}"
        ),
        severity=_regression_severity(snapshot),
        metadata={
            "regression_id": str(snapshot.id),
            "project_id": str(snapshot.project_id),
            "path": f"/regressions/{snapshot.id}",
            "metric_name": snapshot.metric_name,
            "scope_type": snapshot.scope_type,
            "scope_id": snapshot.scope_id,
        },
    )


def get_project_timeline(db: Session, *, project_id: UUID, limit: int = 100) -> list[TimelineEvent]:
    incidents = db.scalars(
        select(Incident)
        .where(Incident.project_id == project_id)
        .order_by(desc(Incident.started_at), desc(Incident.id))
        .limit(limit)
    ).all()

    deployments = db.scalars(
        select(Deployment)
        .options(
            selectinload(Deployment.prompt_version),
            selectinload(Deployment.model_version),
        )
        .where(Deployment.project_id == project_id)
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
        .limit(limit)
    ).all()

    regressions = db.scalars(
        select(RegressionSnapshot)
        .where(RegressionSnapshot.project_id == project_id)
        .order_by(desc(RegressionSnapshot.detected_at), desc(RegressionSnapshot.id))
        .limit(limit)
    ).all()

    guardrail_events = db.scalars(
        select(GuardrailEvent)
        .join(GuardrailEvent.trace)
        .options(
            selectinload(GuardrailEvent.trace),
            selectinload(GuardrailEvent.policy),
        )
        .where(Trace.project_id == project_id)
        .order_by(desc(GuardrailEvent.created_at), desc(GuardrailEvent.id))
        .limit(limit)
    ).all()
    guardrail_runtime_events = db.scalars(
        select(GuardrailRuntimeEvent)
        .join(GuardrailRuntimeEvent.policy)
        .options(selectinload(GuardrailRuntimeEvent.policy))
        .where(GuardrailPolicy.project_id == project_id)
        .order_by(desc(GuardrailRuntimeEvent.created_at), desc(GuardrailRuntimeEvent.id))
        .limit(limit)
    ).all()
    deployment_risk_scores = db.scalars(
        select(DeploymentRiskScore)
        .join(DeploymentRiskScore.deployment)
        .options(
            selectinload(DeploymentRiskScore.deployment).selectinload(Deployment.prompt_version),
            selectinload(DeploymentRiskScore.deployment).selectinload(Deployment.model_version),
        )
        .where(Deployment.project_id == project_id)
        .order_by(desc(DeploymentRiskScore.created_at), desc(DeploymentRiskScore.id))
        .limit(limit)
    ).all()
    deployment_simulations = db.scalars(
        select(DeploymentSimulation)
        .options(
            selectinload(DeploymentSimulation.prompt_version),
            selectinload(DeploymentSimulation.model_version),
        )
        .where(
            DeploymentSimulation.project_id == project_id,
            DeploymentSimulation.risk_level.is_not(None),
        )
        .order_by(desc(DeploymentSimulation.created_at), desc(DeploymentSimulation.id))
        .limit(limit)
    ).all()

    merged = [
        *[_incident_event(item) for item in incidents],
        *[_deployment_event(item) for item in deployments],
        *[_deployment_risk_event(item) for item in deployment_risk_scores],
        *[_deployment_simulation_event(item) for item in deployment_simulations],
        *[_guardrail_event(item) for item in guardrail_events],
        *[_guardrail_runtime_event(item) for item in guardrail_runtime_events],
        *[_regression_event(item) for item in regressions],
    ]
    merged.sort(
        key=lambda item: (
            item.timestamp,
            item.event_type,
            (item.metadata or {}).get("incident_id")
            or (item.metadata or {}).get("deployment_id")
            or (item.metadata or {}).get("deployment_risk_score_id")
            or (item.metadata or {}).get("deployment_simulation_id")
            or (item.metadata or {}).get("guardrail_event_id")
            or (item.metadata or {}).get("guardrail_runtime_event_id")
            or (item.metadata or {}).get("regression_id")
            or "",
        ),
        reverse=True,
    )
    return merged[:limit]
