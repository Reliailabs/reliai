from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.environment import Environment
from app.models.metadata_cardinality import MetadataCardinality
from app.models.project import Project
from app.models.trace_ingestion_policy import TraceIngestionPolicy
from app.schemas.trace import TraceIngestRequest
from app.schemas.trace_ingestion_policy import TraceIngestionPolicyUpdate
from app.services.environments import get_default_environment, get_environment_by_name

DEFAULT_SENSITIVE_FIELD_PATTERNS = [
    "authorization",
    "password",
    "secret",
    "token",
    "api_key",
    "cookie",
    "session",
    "ssn",
]


@dataclass(frozen=True)
class TraceIngestionControlResult:
    payload: TraceIngestRequest
    policy: TraceIngestionPolicy
    environment: Environment
    publish_event: bool
    redacted_fields: list[str]
    dropped_metadata_fields: list[str]


def _policy_defaults(*, project_id: UUID, environment_id: UUID | None) -> TraceIngestionPolicy:
    return TraceIngestionPolicy(
        project_id=project_id,
        environment_id=environment_id,
        sampling_success_rate=1.0,
        sampling_error_rate=1.0,
        max_metadata_fields=50,
        max_cardinality_per_field=250,
        retention_days_success=14,
        retention_days_error=30,
        created_at=datetime.now(timezone.utc),
    )


def _normalize_metadata_value(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _metadata_value_hash(value: Any) -> str:
    return hashlib.sha256(_normalize_metadata_value(value).encode("utf-8")).hexdigest()


def _field_is_sensitive(field_name: str) -> bool:
    lowered = field_name.strip().lower()
    return any(pattern in lowered for pattern in DEFAULT_SENSITIVE_FIELD_PATTERNS)


def get_effective_ingestion_policy(
    db: Session,
    *,
    project_id: UUID,
    environment_id: UUID | None = None,
) -> TraceIngestionPolicy:
    if environment_id is not None:
        scoped = db.scalar(
            select(TraceIngestionPolicy).where(
                TraceIngestionPolicy.project_id == project_id,
                TraceIngestionPolicy.environment_id == environment_id,
            )
        )
        if scoped is not None:
            return scoped

    project_default = db.scalar(
        select(TraceIngestionPolicy).where(
            TraceIngestionPolicy.project_id == project_id,
            TraceIngestionPolicy.environment_id.is_(None),
        )
    )
    if project_default is not None:
        return project_default
    return _policy_defaults(project_id=project_id, environment_id=None)


def list_metadata_cardinality(
    db: Session,
    *,
    project_id: UUID,
    environment_id: UUID | None,
) -> list[MetadataCardinality]:
    if environment_id is None:
        return []
    return list(
        db.scalars(
            select(MetadataCardinality)
            .where(
                MetadataCardinality.project_id == project_id,
                MetadataCardinality.environment_id == environment_id,
            )
            .order_by(
                MetadataCardinality.unique_values_count.desc(),
                MetadataCardinality.field_name.asc(),
            )
        ).all()
    )


def upsert_project_ingestion_policy(
    db: Session,
    *,
    project: Project,
    payload: TraceIngestionPolicyUpdate,
) -> TraceIngestionPolicy:
    policy = db.scalar(
        select(TraceIngestionPolicy).where(
            TraceIngestionPolicy.project_id == project.id,
            TraceIngestionPolicy.environment_id.is_(None),
        )
    )
    if policy is None:
        policy = TraceIngestionPolicy(project_id=project.id, environment_id=None)
        db.add(policy)
    policy.sampling_success_rate = payload.sampling_success_rate
    policy.sampling_error_rate = payload.sampling_error_rate
    policy.max_metadata_fields = payload.max_metadata_fields
    policy.max_cardinality_per_field = payload.max_cardinality_per_field
    policy.retention_days_success = payload.retention_days_success
    policy.retention_days_error = payload.retention_days_error
    db.commit()
    db.refresh(policy)
    return policy


def resolve_trace_environment(db: Session, *, project: Project) -> Environment:
    environment = get_environment_by_name(db, project_id=project.id, name=project.environment)
    if environment is not None:
        return environment
    return get_default_environment(db, project_id=project.id)


def apply_sampling_policy(trace: TraceIngestRequest, policy: TraceIngestionPolicy) -> bool:
    sampling_rate = policy.sampling_success_rate if trace.success else policy.sampling_error_rate
    if sampling_rate <= 0:
        return False
    if sampling_rate >= 1:
        return True
    return random.random() < sampling_rate


def filter_sensitive_fields(trace: TraceIngestRequest) -> tuple[TraceIngestRequest, list[str]]:
    metadata = dict(trace.metadata_json or {})
    if not metadata:
        return trace, []

    sanitized = dict(metadata)
    redacted_fields: list[str] = []
    for key in sorted(metadata.keys()):
        if _field_is_sensitive(key):
            sanitized[key] = "[redacted]"
            redacted_fields.append(key)

    return trace.model_copy(update={"metadata_json": sanitized}), redacted_fields


def _cardinality_record(
    db: Session,
    *,
    project_id: UUID,
    environment_id: UUID,
    field_name: str,
) -> MetadataCardinality | None:
    return db.scalar(
        select(MetadataCardinality).where(
            MetadataCardinality.project_id == project_id,
            MetadataCardinality.environment_id == environment_id,
            MetadataCardinality.field_name == field_name,
        )
    )


def apply_metadata_limits(
    db: Session,
    *,
    project: Project,
    environment: Environment,
    trace: TraceIngestRequest,
    policy: TraceIngestionPolicy,
) -> tuple[TraceIngestRequest, list[str]]:
    metadata = dict(trace.metadata_json or {})
    if not metadata:
        return trace, []

    kept: dict[str, Any] = {}
    dropped_fields: list[str] = []

    for key in sorted(metadata.keys()):
        if len(kept) >= policy.max_metadata_fields:
            dropped_fields.append(key)
            continue

        value = metadata[key]
        record = _cardinality_record(
            db,
            project_id=project.id,
            environment_id=environment.id,
            field_name=key,
        )
        value_hash = _metadata_value_hash(value)
        if record is None:
            record = MetadataCardinality(
                project_id=project.id,
                environment_id=environment.id,
                field_name=key,
                unique_values_count=1,
                observed_value_hashes_json=[value_hash],
            )
            db.add(record)
            kept[key] = value
            continue

        observed_hashes = list(record.observed_value_hashes_json or [])
        if value_hash not in observed_hashes:
            if record.unique_values_count >= policy.max_cardinality_per_field:
                dropped_fields.append(key)
                continue
            observed_hashes.append(value_hash)
            record.observed_value_hashes_json = observed_hashes
            record.unique_values_count = len(observed_hashes)
        kept[key] = value

    return trace.model_copy(update={"metadata_json": kept or None}), dropped_fields


def apply_trace_ingestion_controls(
    db: Session,
    *,
    project: Project,
    payload: TraceIngestRequest,
) -> TraceIngestionControlResult:
    environment = (
        get_environment_by_name(db, project_id=project.id, name=payload.environment)
        if payload.environment is not None
        else resolve_trace_environment(db, project=project)
    )
    if environment is None:
        environment = get_default_environment(db, project_id=project.id)
    policy = get_effective_ingestion_policy(
        db,
        project_id=project.id,
        environment_id=environment.id,
    )
    sanitized_payload, redacted_fields = filter_sensitive_fields(payload)
    limited_payload, dropped_metadata_fields = apply_metadata_limits(
        db,
        project=project,
        environment=environment,
        trace=sanitized_payload,
        policy=policy,
    )
    if dropped_metadata_fields:
        metadata = dict(limited_payload.metadata_json or {})
        metadata["_reliai_payload_truncated"] = True
        metadata["_reliai_dropped_metadata_fields"] = len(dropped_metadata_fields)
        limited_payload = limited_payload.model_copy(update={"metadata_json": metadata})
    return TraceIngestionControlResult(
        payload=limited_payload,
        policy=policy,
        environment=environment,
        publish_event=apply_sampling_policy(limited_payload, policy),
        redacted_fields=redacted_fields,
        dropped_metadata_fields=dropped_metadata_fields,
    )
