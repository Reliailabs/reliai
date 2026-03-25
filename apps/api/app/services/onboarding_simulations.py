from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.deployment_simulation import DeploymentSimulation
from app.models.environment import ENVIRONMENT_PRODUCTION
from app.models.incident import Incident
from app.models.prompt_version import PromptVersion
from app.models.project import Project
from app.models.trace import Trace
from app.schemas.project import ProjectCreate
from app.schemas.trace import TraceIngestRequest
from app.services.auth import OperatorContext
from app.services.authorization import authorized_project_ids, require_project_access
from app.services.environments import get_default_environment
from app.services.projects import create_project
from app.services.registry import ensure_prompt_version_record
from app.services.traces import create_trace
from app.workers.regression_detection import run_trace_regression_detection

SIM_STATUS_PENDING = "pending"
SIM_STATUS_RUNNING = "running"
SIM_STATUS_COMPLETE = "complete"
SIM_STATUS_FAILED = "failed"

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _analysis_payload(
    *,
    status: str,
    progress: int,
    stage: str,
    incident_id: str | None = None,
    error: str | None = None,
    simulation_type: str = "refusal_spike",
) -> dict:
    payload = {
        "status": status,
        "progress": max(0, min(progress, 100)),
        "stage": stage,
        "simulation_type": simulation_type,
    }
    if incident_id is not None:
        payload["incident_id"] = incident_id
    if error is not None:
        payload["error"] = error
    return payload


def _select_or_create_project(
    db: Session,
    *,
    operator: OperatorContext,
    project_name: str | None,
) -> Project:
    if operator.active_organization_id is None:
        raise ValueError("No active organization selected")

    allowed_project_ids = authorized_project_ids(
        db,
        operator,
        organization_id=operator.active_organization_id,
    )

    if project_name:
        normalized_name = project_name.strip()
        if allowed_project_ids:
            existing_named = db.scalar(
                select(Project)
                .where(
                    Project.id.in_(allowed_project_ids),
                    func.lower(Project.name) == normalized_name.lower(),
                )
                .order_by(Project.created_at.asc(), Project.id.asc())
            )
            if existing_named is not None:
                return existing_named

        payload = ProjectCreate(
            name=normalized_name,
            environment=ENVIRONMENT_PRODUCTION,
            description="Auto-created project for onboarding simulation flow.",
        )
        return create_project(db, operator.active_organization_id, payload)

    if allowed_project_ids:
        existing = db.scalar(
            select(Project)
            .where(Project.id.in_(allowed_project_ids))
            .order_by(Project.created_at.asc(), Project.id.asc())
        )
        if existing is not None:
            return existing

    payload = ProjectCreate(
        name=project_name or "Quickstart Simulation Project",
        environment=ENVIRONMENT_PRODUCTION,
        description="Auto-created project for onboarding simulation flow.",
    )
    return create_project(db, operator.active_organization_id, payload)


def create_onboarding_simulation(
    db: Session,
    operator: OperatorContext,
    *,
    project_name: str | None,
    model_name: str | None,
    prompt_type: str | None,
    simulation_type: str,
) -> DeploymentSimulation:
    normalized_project_name = project_name.strip() if isinstance(project_name, str) else None
    normalized_model_name = model_name.strip() if isinstance(model_name, str) else None
    normalized_prompt_type = prompt_type.strip() if isinstance(prompt_type, str) else None

    project = _select_or_create_project(
        db,
        operator=operator,
        project_name=normalized_project_name,
    )
    require_project_access(db, operator, project.id)
    environment = get_default_environment(db, project_id=project.id)

    simulation = DeploymentSimulation(
        project_id=project.id,
        environment_id=environment.id,
        prompt_version_id=None,
        model_version_id=None,
        trace_sample_size=36,
        predicted_failure_rate=None,
        predicted_latency_ms=None,
        risk_level=None,
        analysis_json=_analysis_payload(
            status=SIM_STATUS_PENDING,
            progress=0,
            stage="queued",
            simulation_type=simulation_type,
        ),
        created_at=_now(),
    )
    simulation.analysis_json["project_name"] = normalized_project_name or project.name
    simulation.analysis_json["model_name"] = normalized_model_name or "gpt-4o"
    simulation.analysis_json["prompt_type"] = normalized_prompt_type or "support_triage"

    db.add(simulation)
    db.commit()
    db.refresh(simulation)
    logger.info(
        "onboarding simulation created",
        extra={
            "simulation_id": str(simulation.id),
            "project_id": str(simulation.project_id),
            "environment_id": str(simulation.environment_id),
            "simulation_type": simulation_type,
            "model_name": simulation.analysis_json.get("model_name"),
            "prompt_type": simulation.analysis_json.get("prompt_type"),
        },
    )
    return simulation


def get_onboarding_simulation(
    db: Session,
    operator: OperatorContext,
    *,
    simulation_id: UUID,
) -> DeploymentSimulation | None:
    simulation = db.get(DeploymentSimulation, simulation_id)
    if simulation is None:
        return None
    require_project_access(db, operator, simulation.project_id)
    return simulation


def _set_simulation_state(
    db: Session,
    *,
    simulation: DeploymentSimulation,
    status: str,
    progress: int,
    stage: str,
    incident_id: str | None = None,
    error: str | None = None,
) -> None:
    preserved = {
        key: value
        for key, value in (simulation.analysis_json or {}).items()
        if key not in {"status", "progress", "stage", "incident_id", "error"}
    }
    simulation.analysis_json = {
        **preserved,
        **_analysis_payload(
            status=status,
            progress=progress,
            stage=stage,
            incident_id=incident_id,
            error=error,
            simulation_type=str((simulation.analysis_json or {}).get("simulation_type") or "refusal_spike"),
        ),
    }
    db.add(simulation)
    db.commit()
    db.refresh(simulation)


def _seed_prompt_versions(db: Session, *, project: Project) -> tuple[PromptVersion, PromptVersion]:
    from_version = "v17"
    to_version = "v18"
    v17 = ensure_prompt_version_record(db, project=project, version=from_version)
    v18 = ensure_prompt_version_record(db, project=project, version=to_version)
    if v17 is not None and not v17.notes:
        v17.notes = (
            "System role: helpful support assistant\n"
            "Answer directly when policy allows.\n"
            "If uncertain, ask one clarifying question.\n"
            "Do not refuse unless request is unsafe."
        )
        db.add(v17)
    if v18 is not None and not v18.notes:
        v18.notes = (
            "System role: strict policy-first support assistant\n"
            "Apply policy checks before every answer.\n"
            "Prefer refusal when safety confidence is below threshold.\n"
            "If uncertain, respond with policy-safe refusal."
        )
        db.add(v18)
    db.commit()
    assert v17 is not None
    assert v18 is not None
    db.refresh(v17)
    db.refresh(v18)
    return v17, v18


def _create_synthetic_trace(
    db: Session,
    *,
    project: Project,
    timestamp: datetime,
    request_id: str,
    model_name: str,
    prompt_type: str,
    prompt_version: str,
    success: bool,
    output_text: str,
    latency_ms: int,
) -> Trace:
    payload = TraceIngestRequest(
        timestamp=timestamp,
        request_id=request_id,
        model_name=model_name,
        model_provider="openai",
        prompt_version=prompt_version,
        input_text=f"User asks for {prompt_type.replace('_', ' ')} troubleshooting steps.",
        output_text=output_text,
        latency_ms=latency_ms,
        prompt_tokens=220,
        completion_tokens=90,
        total_cost_usd=0.0032,
        success=success,
        error_type=None if success else "refusal_error",
        metadata_json={
            "expected_output_format": "json",
            "structured_output": True,
            "simulation": True,
        },
    )
    trace = create_trace(db, project, payload)
    return trace


def _trace_window_bounds(traces: list[Trace]) -> tuple[str | None, str | None]:
    if not traces:
        return None, None
    timestamps = sorted(trace.timestamp for trace in traces)
    return timestamps[0].isoformat(), (timestamps[-1] + timedelta(seconds=1)).isoformat()


def _onboarding_compare_metadata(
    *,
    simulation: DeploymentSimulation,
    project: Project,
    baseline_prompt: PromptVersion,
    failing_prompt: PromptVersion,
    baseline_traces: list[Trace],
    failing_traces: list[Trace],
) -> dict[str, object]:
    baseline_window_start, baseline_window_end = _trace_window_bounds(baseline_traces)
    current_window_start, current_window_end = _trace_window_bounds(failing_traces)
    sample_trace_ids = [str(trace.id) for trace in (failing_traces[:3] + baseline_traces[:2])]
    return {
        "scope_type": "project",
        "scope_id": str(project.id),
        "source": "onboarding_simulation",
        "simulation_id": str(simulation.id),
        "baseline_window_start": baseline_window_start,
        "baseline_window_end": baseline_window_end,
        "current_window_start": current_window_start,
        "current_window_end": current_window_end,
        "baseline_prompt_version_id": str(baseline_prompt.id),
        "baseline_prompt_version": baseline_prompt.version,
        "current_prompt_version_id": str(failing_prompt.id),
        "current_prompt_version": failing_prompt.version,
        "sample_trace_ids": sample_trace_ids,
    }


def _merge_incident_summary(existing: dict | None, additions: dict[str, object]) -> dict:
    merged = dict(existing or {})
    for key, value in additions.items():
        existing_value = merged.get(key)
        if key not in merged or existing_value is None or existing_value == [] or existing_value == "":
            merged[key] = value
    return merged


def _create_fallback_incident(
    db: Session,
    *,
    simulation: DeploymentSimulation,
    project: Project,
    compare_metadata: dict[str, object],
) -> Incident:
    now = _now()
    incident = Incident(
        organization_id=project.organization_id,
        project_id=project.id,
        environment_id=simulation.environment_id,
        deployment_id=None,
        incident_type="success_rate_drop",
        severity="high",
        title="Onboarding simulation regression detected",
        status="open",
        fingerprint=f"onboarding-simulation:{simulation.id}",
        summary_json={
            **compare_metadata,
            "metric_name": "success_rate",
            "scope_type": "project",
            "scope_id": str(project.id),
            "source": "onboarding_simulation_fallback",
            "simulation_id": str(simulation.id),
        },
        started_at=now,
        updated_at=now,
        resolved_at=None,
        acknowledged_at=None,
        acknowledged_by_operator_user_id=None,
        owner_operator_user_id=None,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


def run_onboarding_simulation(simulation_id: UUID) -> None:
    db = SessionLocal()
    try:
        simulation = db.get(DeploymentSimulation, simulation_id)
        if simulation is None:
            logger.warning(
                "onboarding simulation skipped because record was not found",
                extra={"simulation_id": str(simulation_id)},
            )
            return

        current_status = str((simulation.analysis_json or {}).get("status") or SIM_STATUS_PENDING)
        if current_status in {SIM_STATUS_RUNNING, SIM_STATUS_COMPLETE}:
            logger.info(
                "onboarding simulation skipped because it is already in a terminal or running state",
                extra={"simulation_id": str(simulation.id), "status": current_status},
            )
            return

        project = db.get(Project, simulation.project_id)
        if project is None:
            _set_simulation_state(
                db,
                simulation=simulation,
                status=SIM_STATUS_FAILED,
                progress=100,
                stage="failed",
                error="Project not found for simulation",
            )
            logger.error(
                "onboarding simulation failed because project was missing",
                extra={"simulation_id": str(simulation.id), "project_id": str(simulation.project_id)},
            )
            return

        model_name = str((simulation.analysis_json or {}).get("model_name") or "gpt-4o")
        prompt_type = str((simulation.analysis_json or {}).get("prompt_type") or "support_triage")

        logger.info(
            "onboarding simulation started",
            extra={
                "simulation_id": str(simulation.id),
                "project_id": str(project.id),
                "model_name": model_name,
                "prompt_type": prompt_type,
            },
        )

        _set_simulation_state(
            db,
            simulation=simulation,
            status=SIM_STATUS_RUNNING,
            progress=10,
            stage="generating_baseline",
        )
        baseline_prompt, failing_prompt = _seed_prompt_versions(db, project=project)
        simulation.prompt_version_id = failing_prompt.id
        simulation.analysis_json = {
            **(simulation.analysis_json or {}),
            "baseline_prompt_version_id": str(baseline_prompt.id),
            "baseline_prompt_version": baseline_prompt.version,
            "current_prompt_version_id": str(failing_prompt.id),
            "current_prompt_version": failing_prompt.version,
        }
        db.add(simulation)
        db.commit()
        db.refresh(simulation)

        now = _now()
        generated_trace_count = 0
        baseline_traces: list[Trace] = []
        for index in range(18):
            baseline_trace = _create_synthetic_trace(
                db,
                project=project,
                timestamp=now - timedelta(minutes=120 - (index * 2)),
                request_id=f"sim_baseline_{index:02d}_{simulation.id}",
                model_name=model_name,
                prompt_type=prompt_type,
                prompt_version=baseline_prompt.version,
                success=True,
                output_text="{\"result\": \"Account access reset instructions\"}",
                latency_ms=420,
            )
            baseline_traces.append(baseline_trace)
            generated_trace_count += 1

        _set_simulation_state(
            db,
            simulation=simulation,
            status=SIM_STATUS_RUNNING,
            progress=45,
            stage="injecting_regression",
        )

        last_trace_id: str | None = None
        failing_traces: list[Trace] = []
        for index in range(18):
            is_failure = index < 10
            failing_trace = _create_synthetic_trace(
                db,
                project=project,
                timestamp=now - timedelta(minutes=55 - (index * 3)),
                request_id=f"sim_failing_{index:02d}_{simulation.id}",
                model_name=model_name,
                prompt_type=prompt_type,
                prompt_version=failing_prompt.version,
                success=not is_failure,
                output_text=(
                    "I cannot assist with this request under the current policy." if is_failure
                    else "{\"result\": \"Please verify MFA and reset your password\"}"
                ),
                latency_ms=640 if is_failure else 480,
            )
            failing_traces.append(failing_trace)
            last_trace_id = str(failing_trace.id)
            generated_trace_count += 1

        compare_metadata = _onboarding_compare_metadata(
            simulation=simulation,
            project=project,
            baseline_prompt=baseline_prompt,
            failing_prompt=failing_prompt,
            baseline_traces=baseline_traces,
            failing_traces=failing_traces,
        )
        simulation.analysis_json = {
            **(simulation.analysis_json or {}),
            **compare_metadata,
        }
        db.add(simulation)
        db.commit()
        db.refresh(simulation)

        logger.info(
            "onboarding simulation traces generated",
            extra={
                "simulation_id": str(simulation.id),
                "project_id": str(project.id),
                "baseline_prompt": baseline_prompt.version,
                "candidate_prompt": failing_prompt.version,
                "trace_count": generated_trace_count,
            },
        )

        _set_simulation_state(
            db,
            simulation=simulation,
            status=SIM_STATUS_RUNNING,
            progress=75,
            stage="detecting_incident",
        )

        if last_trace_id is not None:
            logger.info(
                "onboarding simulation triggering regression detection",
                extra={
                    "simulation_id": str(simulation.id),
                    "project_id": str(project.id),
                    "trace_id": last_trace_id,
                },
            )
            run_trace_regression_detection(last_trace_id)

        incident = db.scalar(
            select(Incident)
            .where(
                Incident.project_id == project.id,
                Incident.started_at >= simulation.created_at,
            )
            .order_by(desc(Incident.started_at), desc(Incident.id))
        )

        if incident is None:
            logger.warning(
                "onboarding simulation produced no incident from regression detection; creating fallback incident",
                extra={"simulation_id": str(simulation.id), "project_id": str(project.id)},
            )
            try:
                incident = _create_fallback_incident(
                    db,
                    simulation=simulation,
                    project=project,
                    compare_metadata=compare_metadata,
                )
            except Exception as fallback_exc:
                _set_simulation_state(
                    db,
                    simulation=simulation,
                    status=SIM_STATUS_FAILED,
                    progress=100,
                    stage="failed",
                    error=(
                        "Simulation completed but no incident was created, "
                        f"and fallback incident creation failed: {fallback_exc}"
                    ),
                )
                logger.error(
                    "onboarding simulation finished without incident and fallback failed",
                    extra={
                        "simulation_id": str(simulation.id),
                        "project_id": str(project.id),
                        "error": str(fallback_exc),
                    },
                )
                return
        else:
            merged_summary = _merge_incident_summary(incident.summary_json, compare_metadata)
            if merged_summary != (incident.summary_json or {}):
                incident.summary_json = merged_summary
                db.add(incident)
                db.commit()
                db.refresh(incident)

        _set_simulation_state(
            db,
            simulation=simulation,
            status=SIM_STATUS_COMPLETE,
            progress=100,
            stage="complete",
            incident_id=str(incident.id),
        )
        logger.info(
            "onboarding simulation created incident",
            extra={
                "simulation_id": str(simulation.id),
                "project_id": str(project.id),
                "incident_id": str(incident.id),
            },
        )
    except Exception as exc:
        db.rollback()
        simulation = db.get(DeploymentSimulation, simulation_id)
        if simulation is not None:
            _set_simulation_state(
                db,
                simulation=simulation,
                status=SIM_STATUS_FAILED,
                progress=100,
                stage="failed",
                error=str(exc),
            )
        logger.exception(
            "onboarding simulation failed",
            extra={"simulation_id": str(simulation_id), "error": str(exc)},
        )
    finally:
        db.close()
