from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.platform_extension import PlatformExtension
from app.models.processor_failure import ProcessorFailure
from app.models.project import Project
from app.schemas.external_processor import ExternalProcessorCreate
from app.schemas.platform_extension import PlatformExtensionCreate
from app.services.audit_log import log_action
from app.services.usage_quotas import enforce_processor_quota

RECENT_FAILURE_WINDOW_HOURS = 24
DEFAULT_ALLOWED_EVENTS = [
    "trace_ingested",
    "trace_evaluated",
    "incident_created",
    "deployment_created",
]


def _normalize_config(config_json: dict[str, Any], *, event_type: str) -> dict[str, Any]:
    config = dict(config_json or {})
    allowed_events = [str(item) for item in config.get("allowed_events", [event_type]) if str(item).strip()]
    if event_type not in allowed_events:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Extension allowed_events must include event_type")
    runtime_limits = dict(config.get("runtime_limits") or {})
    timeout_seconds = int(runtime_limits.get("timeout_seconds", 10))
    max_retries = int(runtime_limits.get("max_retries", 3))
    timeout_seconds = max(1, min(timeout_seconds, 30))
    max_retries = max(0, min(max_retries, 5))
    config["allowed_events"] = allowed_events or [event_type]
    config["runtime_limits"] = {
        "timeout_seconds": timeout_seconds,
        "max_retries": max_retries,
    }
    runtime_stats = dict(config.get("_runtime") or {})
    config["_runtime"] = {
        "hour_bucket": runtime_stats.get("hour_bucket"),
        "hour_invocations": int(runtime_stats.get("hour_invocations", 0)),
        "hour_failures": int(runtime_stats.get("hour_failures", 0)),
        "total_invocations": int(runtime_stats.get("total_invocations", 0)),
        "successful_invocations": int(runtime_stats.get("successful_invocations", 0)),
        "failed_invocations": int(runtime_stats.get("failed_invocations", 0)),
        "last_invoked_at": runtime_stats.get("last_invoked_at"),
        "last_failure_at": runtime_stats.get("last_failure_at"),
    }
    return config


def _failure_stats(db: Session, *, processor_id: UUID) -> tuple[int, datetime | None]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RECENT_FAILURE_WINDOW_HOURS)
    row = db.execute(
        select(func.count(ProcessorFailure.id), func.max(ProcessorFailure.created_at)).where(
            ProcessorFailure.external_processor_id == processor_id,
            ProcessorFailure.created_at >= cutoff,
        )
    ).one()
    return int(row[0] or 0), row[1]


def _extension_health(*, enabled: bool, recent_failure_count: int, runtime_stats: dict[str, Any]) -> str:
    if not enabled:
        return "disabled"
    if recent_failure_count > 0 or int(runtime_stats.get("hour_failures", 0)) > 0:
        return "degraded"
    return "healthy"


def extension_read_model(db: Session, extension: PlatformExtension) -> dict[str, Any]:
    runtime_stats = dict((extension.config_json or {}).get("_runtime") or {})
    recent_failure_count, last_failure_at = _failure_stats(db, processor_id=extension.processor_id)
    processor = extension.processor
    return {
        "id": extension.id,
        "organization_id": extension.organization_id,
        "project_id": extension.project_id,
        "processor_id": extension.processor_id,
        "name": extension.name,
        "processor_type": extension.processor_type,
        "version": extension.version,
        "event_type": processor.event_type if processor is not None else "unknown",
        "endpoint_url": processor.endpoint_url if processor is not None else "",
        "enabled": extension.enabled and bool(processor.enabled if processor is not None else False),
        "config_json": extension.config_json or {},
        "health": _extension_health(
            enabled=extension.enabled and bool(processor.enabled if processor is not None else False),
            recent_failure_count=recent_failure_count,
            runtime_stats=runtime_stats,
        ),
        "event_throughput_per_hour": int(runtime_stats.get("hour_invocations", 0)),
        "recent_failure_count": recent_failure_count,
        "last_invoked_at": runtime_stats.get("last_invoked_at"),
        "last_failure_at": last_failure_at or runtime_stats.get("last_failure_at"),
        "created_at": extension.created_at,
    }


def list_platform_extensions(db: Session, *, organization_id: UUID) -> list[dict[str, Any]]:
    extensions = list(
        db.scalars(
            select(PlatformExtension)
            .where(PlatformExtension.organization_id == organization_id)
            .order_by(PlatformExtension.created_at.desc(), PlatformExtension.name.asc())
        ).all()
    )
    return [extension_read_model(db, extension) for extension in extensions]


def list_system_platform_extensions(db: Session) -> list[dict[str, Any]]:
    from app.processors.registry import core_processor_descriptors

    extensions = list(
        db.scalars(select(PlatformExtension).order_by(PlatformExtension.created_at.desc(), PlatformExtension.name.asc())).all()
    )
    items = [extension_read_model(db, extension) for extension in extensions]
    core_items = [
        {
            "id": descriptor.processor_id,
            "organization_id": None,
            "project_id": None,
            "processor_id": None,
            "name": descriptor.processor_id,
            "processor_type": descriptor.processor_type,
            "version": descriptor.version,
            "event_type": descriptor.topic,
            "endpoint_url": "",
            "enabled": True,
            "config_json": {"allowed_events": [], "runtime_limits": {}},
            "health": "healthy",
            "event_throughput_per_hour": 0,
            "recent_failure_count": 0,
            "last_invoked_at": None,
            "last_failure_at": None,
            "created_at": None,
        }
        for descriptor in core_processor_descriptors()
    ]
    return core_items + items


def create_platform_extension(
    db: Session,
    *,
    payload: PlatformExtensionCreate,
    actor_user_id: UUID,
) -> PlatformExtension:
    from app.services.external_processors import create_external_processor

    project = db.get(Project, payload.project_id)
    if project is None or project.organization_id != payload.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project does not belong to organization")
    current_count = int(
        db.scalar(
            select(func.count(PlatformExtension.id)).where(
                PlatformExtension.organization_id == payload.organization_id
            )
        )
        or 0
    )
    enforce_processor_quota(db, organization_id=payload.organization_id, current_count=current_count)
    config_json = _normalize_config(payload.config_json, event_type=payload.event_type)
    processor = create_external_processor(
        db,
        project=project,
        payload=ExternalProcessorCreate(
            name=payload.name,
            event_type=payload.event_type,
            endpoint_url=payload.endpoint_url,
            secret=payload.secret,
            enabled=payload.enabled,
        ),
        actor_user_id=actor_user_id,
    )
    extension = PlatformExtension(
        organization_id=payload.organization_id,
        project_id=payload.project_id,
        processor_id=processor.id,
        name=payload.name.strip(),
        processor_type=payload.processor_type.strip(),
        version=payload.version.strip(),
        config_json=config_json,
        enabled=payload.enabled,
    )
    db.add(extension)
    db.flush()
    log_action(
        db,
        organization_id=payload.organization_id,
        user_id=actor_user_id,
        action="platform_extension_created",
        resource_type="platform_extension",
        resource_id=extension.id,
        metadata={
            "project_id": str(payload.project_id),
            "processor_id": str(processor.id),
            "processor_type": extension.processor_type,
            "version": extension.version,
            "allowed_events": config_json.get("allowed_events", DEFAULT_ALLOWED_EVENTS),
        },
    )
    db.commit()
    db.refresh(extension)
    return extension


def extension_for_processor(db: Session, *, processor_id: UUID) -> PlatformExtension | None:
    return db.scalar(select(PlatformExtension).where(PlatformExtension.processor_id == processor_id))


def extension_runtime_limits(extension: PlatformExtension | None) -> tuple[int, int]:
    if extension is None:
        return 10, 3
    runtime = dict((extension.config_json or {}).get("runtime_limits") or {})
    timeout_seconds = int(runtime.get("timeout_seconds", 10))
    max_retries = int(runtime.get("max_retries", 3))
    return max(1, min(timeout_seconds, 30)), max(0, min(max_retries, 5))


def extension_allows_event(extension: PlatformExtension | None, *, event_type: str) -> bool:
    if extension is None:
        return True
    if not extension.enabled:
        return False
    allowed = [str(item) for item in (extension.config_json or {}).get("allowed_events", [])]
    return event_type in allowed if allowed else True


def record_extension_runtime(
    db: Session,
    *,
    extension: PlatformExtension | None,
    succeeded: bool,
    invoked_at: datetime | None = None,
) -> None:
    if extension is None:
        return
    now = invoked_at or datetime.now(timezone.utc)
    config_json = dict(extension.config_json or {})
    runtime = dict(config_json.get("_runtime") or {})
    hour_bucket = now.replace(minute=0, second=0, microsecond=0).isoformat()
    if runtime.get("hour_bucket") != hour_bucket:
        runtime["hour_bucket"] = hour_bucket
        runtime["hour_invocations"] = 0
        runtime["hour_failures"] = 0
    runtime["hour_invocations"] = int(runtime.get("hour_invocations", 0)) + 1
    runtime["total_invocations"] = int(runtime.get("total_invocations", 0)) + 1
    runtime["last_invoked_at"] = now.isoformat()
    if succeeded:
        runtime["successful_invocations"] = int(runtime.get("successful_invocations", 0)) + 1
    else:
        runtime["failed_invocations"] = int(runtime.get("failed_invocations", 0)) + 1
        runtime["hour_failures"] = int(runtime.get("hour_failures", 0)) + 1
        runtime["last_failure_at"] = now.isoformat()
    config_json["_runtime"] = runtime
    extension.config_json = config_json
    db.add(extension)
    db.commit()
