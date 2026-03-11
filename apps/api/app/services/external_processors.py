from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.external_processor import ExternalProcessor
from app.models.processor_failure import ProcessorFailure
from app.models.project import Project
from app.services.platform_extensions import (
    extension_allows_event,
    extension_for_processor,
    extension_runtime_limits,
    record_extension_runtime,
)
from app.services.audit_log import log_action
from app.schemas.external_processor import ExternalProcessorCreate, ExternalProcessorUpdate
from app.services.event_stream import EventMessage
from app.services.rate_limiter import enforce_rate_limit
from app.services.usage_quotas import enforce_processor_quota
from app.core.settings import get_settings

RECENT_FAILURE_WINDOW_HOURS = 24


@dataclass(frozen=True)
class ExternalProcessorDispatchResult:
    processor_name: str
    success: bool
    attempts: int
    error: str | None = None


def list_project_external_processors(db: Session, *, project_id: UUID) -> list[ExternalProcessor]:
    statement = (
        select(ExternalProcessor)
        .where(ExternalProcessor.project_id == project_id)
        .order_by(ExternalProcessor.created_at.desc(), ExternalProcessor.name.asc())
    )
    return list(db.scalars(statement).all())


def create_external_processor(
    db: Session,
    *,
    project: Project,
    payload: ExternalProcessorCreate,
    actor_user_id: UUID | None = None,
) -> ExternalProcessor:
    current_count = int(
        db.scalar(
            select(func.count(ExternalProcessor.id)).where(ExternalProcessor.project_id == project.id)
        )
        or 0
    )
    enforce_processor_quota(db, organization_id=project.organization_id, current_count=current_count)
    processor = ExternalProcessor(
        project_id=project.id,
        name=payload.name.strip(),
        event_type=payload.event_type.strip(),
        endpoint_url=str(payload.endpoint_url),
        secret=payload.secret,
        enabled=payload.enabled,
    )
    db.add(processor)
    if actor_user_id is not None:
        log_action(
            db,
            organization_id=project.organization_id,
            user_id=actor_user_id,
            action="processor_created",
            resource_type="external_processor",
            resource_id=processor.id,
            metadata={
                "project_id": str(project.id),
                "event_type": processor.event_type,
                "enabled": processor.enabled,
            },
        )
    db.commit()
    db.refresh(processor)
    return processor


def update_external_processor(
    db: Session,
    *,
    project: Project,
    processor_id: UUID,
    payload: ExternalProcessorUpdate,
    actor_user_id: UUID | None = None,
) -> ExternalProcessor:
    processor = db.scalar(
        select(ExternalProcessor).where(
            ExternalProcessor.id == processor_id,
            ExternalProcessor.project_id == project.id,
        )
    )
    if processor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="External processor not found")

    if payload.name is not None:
        processor.name = payload.name.strip()
    if payload.endpoint_url is not None:
        processor.endpoint_url = str(payload.endpoint_url)
    if payload.secret is not None:
        processor.secret = payload.secret
    if payload.enabled is not None:
        processor.enabled = payload.enabled

    db.add(processor)
    if actor_user_id is not None:
        log_action(
            db,
            organization_id=project.organization_id,
            user_id=actor_user_id,
            action="processor_updated",
            resource_type="external_processor",
            resource_id=processor.id,
            metadata={
                "project_id": str(project.id),
                "event_type": processor.event_type,
                "enabled": processor.enabled,
            },
        )
    db.commit()
    db.refresh(processor)
    return processor


def processor_read_model(
    db: Session,
    processor: ExternalProcessor,
) -> dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RECENT_FAILURE_WINDOW_HOURS)
    stats = db.execute(
        select(
            func.count(ProcessorFailure.id),
            func.max(ProcessorFailure.created_at),
        ).where(
            ProcessorFailure.external_processor_id == processor.id,
            ProcessorFailure.created_at >= cutoff,
        )
    ).one()
    return {
        "id": processor.id,
        "project_id": processor.project_id,
        "name": processor.name,
        "event_type": processor.event_type,
        "endpoint_url": processor.endpoint_url,
        "enabled": processor.enabled,
        "has_secret": bool(processor.secret),
        "created_at": processor.created_at,
        "recent_failure_count": int(stats[0] or 0),
        "last_failure_at": stats[1],
    }


def _sign_payload(secret: str, payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _request_payload(event: EventMessage) -> dict[str, Any]:
    return {
        "project_id": str(event.payload["project_id"]),
        "event_type": event.event_type,
        "payload": event.payload,
    }


def _enabled_processors_for_event(db: Session, *, project_id: UUID, event_type: str) -> list[ExternalProcessor]:
    statement = (
        select(ExternalProcessor)
        .where(
            ExternalProcessor.project_id == project_id,
            ExternalProcessor.event_type == event_type,
            ExternalProcessor.enabled.is_(True),
        )
        .order_by(ExternalProcessor.created_at.asc(), ExternalProcessor.name.asc())
    )
    return list(db.scalars(statement).all())


def _record_failure(
    db: Session,
    *,
    processor: ExternalProcessor,
    event: EventMessage,
    attempts: int,
    last_error: str,
) -> None:
    failure = ProcessorFailure(
        external_processor_id=processor.id,
        project_id=processor.project_id,
        event_type=event.event_type,
        attempts=attempts,
        payload_json=_request_payload(event),
        last_error=last_error,
    )
    db.add(failure)
    db.commit()


def _post_to_processor(processor: ExternalProcessor, payload: dict[str, Any]) -> None:
    _post_to_processor_with_timeout(processor, payload, timeout_seconds=10)


def _post_to_processor_with_timeout(
    processor: ExternalProcessor,
    payload: dict[str, Any],
    *,
    timeout_seconds: int,
) -> None:
    signature = _sign_payload(processor.secret, payload)
    response = httpx.post(
        processor.endpoint_url,
        json=payload,
        headers={
            "X-Reliai-Signature": signature,
            "X-Reliai-Event-Type": payload["event_type"],
        },
        timeout=float(timeout_seconds),
    )
    response.raise_for_status()


def _dispatch_processor_targets(
    db: Session,
    *,
    event: EventMessage,
    processors: list[ExternalProcessor],
    label_prefix: str,
) -> list[ExternalProcessorDispatchResult]:
    payload = _request_payload(event)
    results: list[ExternalProcessorDispatchResult] = []
    parsed_project_id = UUID(str(event.payload["project_id"]))
    for processor in processors:
        extension = extension_for_processor(db, processor_id=processor.id)
        if not extension_allows_event(extension, event_type=event.event_type):
            continue
        enforce_rate_limit(
            scope="processor_dispatch",
            key=f"{parsed_project_id}:{processor.id}",
            limit=get_settings().processor_dispatch_rate_limit_per_minute,
            window_seconds=60,
        )
        timeout_seconds, max_retries = extension_runtime_limits(extension)
        attempts = 0
        last_error: str | None = None
        max_attempts = max_retries + 1
        while attempts < max_attempts:
            attempts += 1
            try:
                _post_to_processor_with_timeout(processor, payload, timeout_seconds=timeout_seconds)
                record_extension_runtime(db, extension=extension, succeeded=True)
                last_error = None
                results.append(
                    ExternalProcessorDispatchResult(
                        processor_name=f"{label_prefix}:{processor.name}",
                        success=True,
                        attempts=attempts,
                    )
                )
                break
            except Exception as exc:
                last_error = str(exc)
        if last_error is not None:
            _record_failure(
                db,
                processor=processor,
                event=event,
                attempts=attempts,
                last_error=last_error,
            )
            record_extension_runtime(db, extension=extension, succeeded=False)
            results.append(
                ExternalProcessorDispatchResult(
                    processor_name=f"{label_prefix}:{processor.name}",
                    success=False,
                    attempts=attempts,
                    error=last_error,
                )
            )
    return results


def dispatch_external_processors(event: EventMessage) -> list[ExternalProcessorDispatchResult]:
    project_id = event.payload.get("project_id")
    if project_id is None:
        return []
    try:
        parsed_project_id = UUID(str(project_id))
    except (TypeError, ValueError):
        return []

    db = SessionLocal()
    try:
        processors = _enabled_processors_for_event(
            db,
            project_id=parsed_project_id,
            event_type=event.event_type,
        )
        org_processors = [processor for processor in processors if extension_for_processor(db, processor_id=processor.id) is None]
        return _dispatch_processor_targets(
            db,
            event=event,
            processors=org_processors,
            label_prefix="external",
        )
    finally:
        db.close()


def dispatch_platform_extensions(event: EventMessage) -> list[ExternalProcessorDispatchResult]:
    project_id = event.payload.get("project_id")
    if project_id is None:
        return []
    try:
        parsed_project_id = UUID(str(project_id))
    except (TypeError, ValueError):
        return []

    db = SessionLocal()
    try:
        processors = _enabled_processors_for_event(
            db,
            project_id=parsed_project_id,
            event_type=event.event_type,
        )
        platform_processors = [processor for processor in processors if extension_for_processor(db, processor_id=processor.id) is not None]
        return _dispatch_processor_targets(
            db,
            event=event,
            processors=platform_processors,
            label_prefix="extension",
        )
    finally:
        db.close()
