from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.external_processor import ExternalProcessor
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.processor_failure import ProcessorFailure
from app.models.project import Project
from app.models.trace import Trace
from app.services.auth import OperatorContext
from app.services.authorization import require_project_access
from app.services.deployments import list_project_deployments
from app.services.event_processing_metrics import get_event_pipeline_status
from app.services.timeline import get_project_timeline
from app.services.trace_query_router import query_daily_metrics, query_hourly_metrics

SUMMARY_WINDOW_HOURS = 24
DETAIL_WINDOW_DAYS = 7


@dataclass(frozen=True)
class CustomerHealthProject:
    project_id: UUID
    project_name: str
    trace_volume_24h: int
    traces_per_day: int
    guardrail_rate: float
    incident_rate: float
    processor_failures: int
    processor_failure_rate: float
    pipeline_lag: int
    risk_level: str


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_day(value: datetime) -> datetime:
    utc_value = value.astimezone(timezone.utc) if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime(utc_value.year, utc_value.month, utc_value.day, tzinfo=timezone.utc)


def get_project_trace_volume(project_id: UUID, *, trace_rows: list | None = None) -> int:
    rows = trace_rows or []
    return sum(1 for row in rows if row.project_id == project_id)


def get_project_guardrail_rate(project_id: UUID, *, trace_volume: int, guardrail_count: int) -> float:
    if trace_volume <= 0:
        return 0.0
    return round(guardrail_count / trace_volume, 4)


def get_project_incident_rate(project_id: UUID, *, trace_volume: int, incident_count: int) -> float:
    if trace_volume <= 0:
        return 0.0
    return round(incident_count / trace_volume, 4)


def get_project_processor_failure_rate(project_id: UUID, *, trace_volume: int, failure_count: int) -> float:
    if trace_volume <= 0:
        return 0.0
    return round(failure_count / trace_volume, 4)


def get_project_pipeline_lag(project_id: UUID, *, recent_trace_count: int, recent_warehouse_count: int, pipeline_error_count: int) -> int:
    lag = max(recent_trace_count - recent_warehouse_count, 0)
    if pipeline_error_count > 0 and recent_trace_count > 0:
        lag += pipeline_error_count
    return lag


def _project_risk_level(
    *,
    trace_growth_ratio: float,
    incident_rate: float,
    processor_failures: int,
    pipeline_lag: int,
) -> str:
    high = (
        trace_growth_ratio >= 2.0
        or incident_rate >= 0.01
        or processor_failures >= 3
        or pipeline_lag >= 25
    )
    if high:
        return "high"

    medium = (
        trace_growth_ratio >= 1.25
        or incident_rate >= 0.003
        or processor_failures >= 1
        or pipeline_lag >= 5
    )
    if medium:
        return "medium"
    return "low"


def _summary_windows(now: datetime) -> tuple[datetime, datetime, datetime]:
    current_start = now - timedelta(hours=SUMMARY_WINDOW_HOURS)
    previous_start = current_start - timedelta(hours=SUMMARY_WINDOW_HOURS)
    return current_start, previous_start, now


def _project_map(db: Session, operator: OperatorContext) -> dict[UUID, Project]:
    projects = db.scalars(
        select(Project)
        .where(Project.organization_id.in_(operator.organization_ids))
        .order_by(Project.name.asc(), Project.id.asc())
    ).all()
    return {project.id: project for project in projects}


def list_customer_reliability_projects(db: Session, *, operator: OperatorContext) -> list[CustomerHealthProject]:
    projects = _project_map(db, operator)
    if not projects:
        return []

    now = _utc_now()
    current_start, previous_start, current_end = _summary_windows(now)
    warehouse_rollups = query_hourly_metrics(
        project_id=None,
        environment_id=None,
        start_time=previous_start,
        end_time=current_end,
    )
    current_trace_counts: Counter[UUID] = Counter()
    previous_trace_counts: Counter[UUID] = Counter()
    for row in warehouse_rollups:
        if row.project_id not in projects:
            continue
        if row.time_bucket >= current_start:
            current_trace_counts[row.project_id] += int(row.trace_count)
        else:
            previous_trace_counts[row.project_id] += int(row.trace_count)

    incident_counts = {
        project_id: int(count)
        for project_id, count in db.execute(
            select(Incident.project_id, func.count(Incident.id))
            .where(
                Incident.project_id.in_(projects.keys()),
                Incident.started_at >= current_start,
                Incident.started_at < current_end,
            )
            .group_by(Incident.project_id)
        ).all()
    }

    guardrail_counts = {
        project_id: int(count)
        for project_id, count in db.execute(
            select(GuardrailPolicy.project_id, func.count(GuardrailRuntimeEvent.id))
            .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
            .where(
                GuardrailPolicy.project_id.in_(projects.keys()),
                GuardrailRuntimeEvent.created_at >= current_start,
                GuardrailRuntimeEvent.created_at < current_end,
            )
            .group_by(GuardrailPolicy.project_id)
        ).all()
    }

    failure_counts = {
        project_id: int(count)
        for project_id, count in db.execute(
            select(ProcessorFailure.project_id, func.count(ProcessorFailure.id))
            .where(
                ProcessorFailure.project_id.in_(projects.keys()),
                ProcessorFailure.created_at >= current_start,
                ProcessorFailure.created_at < current_end,
            )
            .group_by(ProcessorFailure.project_id)
        ).all()
    }

    pipeline = get_event_pipeline_status(db)
    pipeline_errors_recent = sum(consumer.error_count_recent for consumer in pipeline.consumers)

    trace_ingest_counts = {
        project_id: int(count)
        for project_id, count in db.execute(
            select(Trace.project_id, func.count(Trace.id))
            .where(
                Trace.project_id.in_(projects.keys()),
                Trace.created_at >= current_start,
                Trace.created_at < current_end,
            )
            .group_by(Trace.project_id)
        ).all()
    }

    items: list[CustomerHealthProject] = []
    for project_id, project in projects.items():
        trace_volume = int(current_trace_counts.get(project_id, 0))
        previous_volume = int(previous_trace_counts.get(project_id, 0))
        trace_growth_ratio = (trace_volume / previous_volume) if previous_volume > 0 else float(trace_volume > 0)
        incidents = int(incident_counts.get(project_id, 0))
        guardrails = int(guardrail_counts.get(project_id, 0))
        failures = int(failure_counts.get(project_id, 0))
        recent_ingested = int(trace_ingest_counts.get(project_id, 0))
        lag = get_project_pipeline_lag(
            project_id,
            recent_trace_count=recent_ingested,
            recent_warehouse_count=trace_volume,
            pipeline_error_count=pipeline_errors_recent,
        )
        items.append(
            CustomerHealthProject(
                project_id=project_id,
                project_name=project.name,
                trace_volume_24h=trace_volume,
                traces_per_day=trace_volume,
                guardrail_rate=get_project_guardrail_rate(project_id, trace_volume=trace_volume, guardrail_count=guardrails),
                incident_rate=get_project_incident_rate(project_id, trace_volume=trace_volume, incident_count=incidents),
                processor_failures=failures,
                processor_failure_rate=get_project_processor_failure_rate(
                    project_id,
                    trace_volume=trace_volume,
                    failure_count=failures,
                ),
                pipeline_lag=lag,
                risk_level=_project_risk_level(
                    trace_growth_ratio=trace_growth_ratio,
                    incident_rate=get_project_incident_rate(project_id, trace_volume=trace_volume, incident_count=incidents),
                    processor_failures=failures,
                    pipeline_lag=lag,
                ),
            )
        )
    return sorted(
        items,
        key=lambda item: (
            {"high": 0, "medium": 1, "low": 2}.get(item.risk_level, 3),
            -item.trace_volume_24h,
            item.project_name.lower(),
        ),
    )


def get_customer_reliability_project_detail(
    db: Session,
    *,
    operator: OperatorContext,
    project_id: UUID,
) -> dict:
    require_project_access(db, operator, project_id)
    summary = next(
        (item for item in list_customer_reliability_projects(db, operator=operator) if item.project_id == project_id),
        None,
    )
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    now = _utc_now()
    chart_start = _start_of_day(now) - timedelta(days=DETAIL_WINDOW_DAYS - 1)
    chart_end = _start_of_day(now) + timedelta(days=1)
    chart_rows = query_daily_metrics(
        project_id=project_id,
        environment_id=None,
        start_time=chart_start,
        end_time=chart_end,
    )
    counts_by_day = Counter({row.time_bucket.date().isoformat(): int(row.trace_count) for row in chart_rows})
    trace_volume_chart = [
        {
            "date": (chart_start + timedelta(days=offset)).date().isoformat(),
            "trace_volume": int(counts_by_day.get((chart_start + timedelta(days=offset)).date().isoformat(), 0)),
        }
        for offset in range(DETAIL_WINDOW_DAYS)
    ]

    recent_guardrails = db.scalars(
        select(GuardrailRuntimeEvent)
        .join(GuardrailPolicy, GuardrailPolicy.id == GuardrailRuntimeEvent.policy_id)
        .options(selectinload(GuardrailRuntimeEvent.policy))
        .where(GuardrailPolicy.project_id == project_id)
        .order_by(GuardrailRuntimeEvent.created_at.desc(), GuardrailRuntimeEvent.id.desc())
        .limit(12)
    ).all()

    recent_incidents = db.scalars(
        select(Incident)
        .where(Incident.project_id == project_id)
        .order_by(Incident.started_at.desc(), Incident.id.desc())
        .limit(12)
    ).all()

    recent_failures = db.scalars(
        select(ProcessorFailure)
        .join(ExternalProcessor, ExternalProcessor.id == ProcessorFailure.external_processor_id)
        .options(selectinload(ProcessorFailure.external_processor))
        .where(ProcessorFailure.project_id == project_id)
        .order_by(ProcessorFailure.created_at.desc(), ProcessorFailure.id.desc())
        .limit(12)
    ).all()

    deployments = list_project_deployments(db, project_id=project_id)[:12]
    timeline = get_project_timeline(db, project_id=project_id, limit=20)

    return {
        "project": summary,
        "trace_volume_chart": trace_volume_chart,
        "guardrail_triggers": [
            {
                "created_at": item.created_at,
                "policy_type": item.policy.policy_type,
                "action_taken": item.action_taken,
                "provider_model": item.provider_model,
                "latency_ms": item.latency_ms,
            }
            for item in recent_guardrails
        ],
        "incident_history": [
            {
                "incident_id": item.id,
                "title": item.title,
                "severity": item.severity,
                "status": item.status,
                "started_at": item.started_at,
            }
            for item in recent_incidents
        ],
        "deployment_changes": [
            {
                "deployment_id": item.id,
                "environment": item.environment,
                "deployed_at": item.deployed_at,
                "deployed_by": item.deployed_by,
            }
            for item in deployments
        ],
        "processor_failures": [
            {
                "failure_id": item.id,
                "processor_name": item.external_processor.name,
                "event_type": item.event_type,
                "attempts": item.attempts,
                "last_error": item.last_error,
                "created_at": item.created_at,
            }
            for item in recent_failures
        ],
        "recent_timeline": list(timeline),
    }
