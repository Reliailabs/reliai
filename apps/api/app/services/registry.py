from __future__ import annotations

import re
from urllib.parse import urlencode

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.model_version import ModelVersion
from app.models.prompt_version import PromptVersion
from app.models.project import Project
from app.models.trace import Trace


def model_identity_key(
    *,
    provider: str | None,
    model_name: str,
    model_version: str | None,
    route_key: str | None,
) -> str:
    return "|".join(
        [
            provider or "",
            model_name,
            model_version or "",
            route_key or "",
        ]
    )


def derive_model_identity(model_name: str) -> tuple[str | None, str | None]:
    normalized = model_name.strip()
    if not normalized:
        return None, None

    revision_match = re.search(r"(\d+(?:\.\d+)+)", normalized)
    if revision_match is None:
        return normalized, None

    revision = revision_match.group(1)
    prefix = normalized[: revision_match.start()].rstrip("-_ /")
    suffix = normalized[revision_match.end() :].lstrip("-_ /")
    family = f"{prefix}-{revision.split('.')[0]}" if prefix else normalized
    if suffix:
        family = f"{family}-{suffix}"
    return family, revision


def ensure_prompt_version_record(db: Session, *, project: Project, version: str | None) -> PromptVersion | None:
    if not version:
        return None
    record = db.scalar(
        select(PromptVersion).where(
            PromptVersion.project_id == project.id,
            PromptVersion.version == version,
        )
    )
    if record is None:
        record = PromptVersion(project_id=project.id, version=version)
        db.add(record)
        db.flush()
    return record


def ensure_model_version_record(
    db: Session,
    *,
    project: Project,
    provider: str | None,
    model_name: str,
    model_version: str | None,
    route_key: str | None,
) -> ModelVersion:
    model_family, model_revision = derive_model_identity(model_name)
    identity_key = model_identity_key(
        provider=provider,
        model_name=model_name,
        model_version=model_version,
        route_key=route_key,
    )
    record = db.scalar(
        select(ModelVersion).where(
            ModelVersion.project_id == project.id,
            ModelVersion.identity_key == identity_key,
        )
    )
    if record is None:
        record = ModelVersion(
            project_id=project.id,
            identity_key=identity_key,
            provider=provider,
            model_name=model_name,
            model_version=model_version,
            model_family=model_family,
            model_revision=model_revision,
            route_key=route_key,
        )
        db.add(record)
        db.flush()
    elif record.model_family is None or record.model_revision is None:
        record.model_family = record.model_family or model_family
        record.model_revision = record.model_revision or model_revision
        db.add(record)
        db.flush()
    return record


def link_trace_registry_records(db: Session, *, trace: Trace, project: Project) -> Trace:
    metadata = trace.metadata_json or {}
    model_version = metadata.get("model_version")
    route_key = metadata.get("model_route")
    prompt_record = ensure_prompt_version_record(db, project=project, version=trace.prompt_version)
    model_record = ensure_model_version_record(
        db,
        project=project,
        provider=trace.model_provider,
        model_name=trace.model_name,
        model_version=model_version if isinstance(model_version, str) else None,
        route_key=route_key if isinstance(route_key, str) else None,
    )
    trace.prompt_version_record_id = prompt_record.id if prompt_record is not None else None
    trace.model_version_record_id = model_record.id
    db.add(trace)
    db.flush()
    return trace


def list_project_prompt_versions(db: Session, *, project_id) -> list[PromptVersion]:
    return db.scalars(
        select(PromptVersion).where(PromptVersion.project_id == project_id).order_by(PromptVersion.version)
    ).all()


def list_project_model_versions(db: Session, *, project_id) -> list[ModelVersion]:
    return db.scalars(
        select(ModelVersion).where(ModelVersion.project_id == project_id).order_by(ModelVersion.model_name)
    ).all()


def get_prompt_version_record(db: Session, *, project_id, prompt_version_id) -> PromptVersion | None:
    return db.scalar(
        select(PromptVersion).where(
            PromptVersion.project_id == project_id,
            PromptVersion.id == prompt_version_id,
        )
    )


def get_model_version_record(db: Session, *, project_id, model_version_id) -> ModelVersion | None:
    return db.scalar(
        select(ModelVersion).where(
            ModelVersion.project_id == project_id,
            ModelVersion.id == model_version_id,
        )
    )


def find_model_version_record(
    db: Session,
    *,
    project_id,
    provider: str | None,
    model_name: str,
    model_version: str | None,
    route_key: str | None,
) -> ModelVersion | None:
    identity_key = model_identity_key(
        provider=provider,
        model_name=model_name,
        model_version=model_version,
        route_key=route_key,
    )
    return db.scalar(
        select(ModelVersion).where(
            ModelVersion.project_id == project_id,
            or_(
                ModelVersion.identity_key == identity_key,
                and_(
                    ModelVersion.provider.is_(None) if provider is None else ModelVersion.provider == provider,
                    ModelVersion.model_name == model_name,
                    ModelVersion.model_version.is_(None)
                    if model_version is None
                    else ModelVersion.model_version == model_version,
                    ModelVersion.route_key.is_(None) if route_key is None else ModelVersion.route_key == route_key,
                ),
            ),
        )
    )


def unresolved_registry_trace_ids(db: Session, *, batch_size: int, skip_ids: set | None = None) -> list:
    statement = select(Trace.id).where(
        or_(
            Trace.prompt_version_record_id.is_(None),
            Trace.model_version_record_id.is_(None),
        )
    )
    if skip_ids:
        statement = statement.where(Trace.id.not_in(skip_ids))
    return db.scalars(statement.order_by(Trace.created_at, Trace.id).limit(batch_size)).all()


def count_unresolved_registry_traces(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Trace)
            .where(
                or_(
                    Trace.prompt_version_record_id.is_(None),
                    Trace.model_version_record_id.is_(None),
                )
            )
        )
        or 0
    )


def build_prompt_version_path(*, project_id, prompt_version_id, version: str) -> tuple[str, str, str]:
    traces_query = urlencode({"project_id": str(project_id), "prompt_version_id": str(prompt_version_id)})
    regressions_query = urlencode({"scope_id": version})
    incidents_query = urlencode(
        {"project_id": str(project_id), "scope_type": "prompt_version", "scope_id": version}
    )
    return (
        f"/traces?{traces_query}",
        f"/projects/{project_id}/regressions?{regressions_query}",
        f"/incidents?{incidents_query}",
    )


def build_model_version_path(*, project_id, model_version_id) -> str:
    return f"/traces?{urlencode({'project_id': str(project_id), 'model_version_id': str(model_version_id)})}"
