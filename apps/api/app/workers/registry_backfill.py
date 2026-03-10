from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.prompt_version import PromptVersion
from app.models.trace import Trace
from app.services.registry import (
    count_unresolved_registry_traces,
    find_model_version_record,
    unresolved_registry_trace_ids,
)

logger = logging.getLogger(__name__)
BATCH_SIZE = 1000


def _resolve_prompt_version_id(db, trace: Trace):
    if trace.prompt_version_record_id is not None or not trace.prompt_version:
        return trace.prompt_version_record_id
    record = db.scalar(
        select(PromptVersion).where(
            PromptVersion.project_id == trace.project_id,
            PromptVersion.version == trace.prompt_version,
        )
    )
    return record.id if record is not None else None


def _resolve_model_version_id(db, trace: Trace):
    if trace.model_version_record_id is not None:
        return trace.model_version_record_id
    metadata = trace.metadata_json or {}
    model_version = metadata.get("model_version")
    route_key = metadata.get("model_route")
    record = find_model_version_record(
        db,
        project_id=trace.project_id,
        provider=trace.model_provider,
        model_name=trace.model_name,
        model_version=model_version if isinstance(model_version, str) else None,
        route_key=route_key if isinstance(route_key, str) else None,
    )
    return record.id if record is not None else None


def _backfill_trace_batch(db, trace_ids: list) -> dict[str, int]:
    traces = (
        db.scalars(
            select(Trace)
            .options(
                selectinload(Trace.project),
                selectinload(Trace.prompt_version_record),
                selectinload(Trace.model_version_record),
            )
            .where(Trace.id.in_(trace_ids))
            .order_by(Trace.created_at, Trace.id)
        )
        .unique()
        .all()
    )
    matched = 0
    unmatched = 0
    updated_projects: set = set()
    unmatched_trace_ids: list = []

    for trace in traces:
        changed = False

        if trace.prompt_version_record_id is None:
            prompt_id = _resolve_prompt_version_id(db, trace)
            if prompt_id is not None:
                trace.prompt_version_record_id = prompt_id
                changed = True

        if trace.model_version_record_id is None:
            model_id = _resolve_model_version_id(db, trace)
            if model_id is not None:
                trace.model_version_record_id = model_id
                changed = True

        if trace.project.last_trace_received_at is None:
            trace.project.last_trace_received_at = db.scalar(
                select(func.max(Trace.created_at)).where(Trace.project_id == trace.project_id)
            )
            db.add(trace.project)
            updated_projects.add(trace.project_id)

        if changed:
            db.add(trace)
            matched += 1
        elif trace.prompt_version_record_id is None or trace.model_version_record_id is None:
            unmatched += 1
            unmatched_trace_ids.append(trace.id)
            logger.info(
                "registry backfill unmatched trace",
                extra={
                    "trace_id": str(trace.id),
                    "project_id": str(trace.project_id),
                    "prompt_version": trace.prompt_version,
                    "model_name": trace.model_name,
                },
            )

    db.commit()
    return {
        "processed": len(traces),
        "matched": matched,
        "unmatched": unmatched,
        "projects_updated": len(updated_projects),
        "unmatched_trace_ids": unmatched_trace_ids,
    }


def run_registry_backfill_batches(db, *, batch_size: int = BATCH_SIZE, max_batches: int | None = None) -> dict[str, int]:
    totals = {
        "processed": 0,
        "matched": 0,
        "unmatched": 0,
        "projects_updated": 0,
        "remaining": 0,
    }
    batch_count = 0
    skipped_ids: set = set()
    while True:
        if max_batches is not None and batch_count >= max_batches:
            break
        trace_ids = unresolved_registry_trace_ids(db, batch_size=batch_size, skip_ids=skipped_ids)
        if not trace_ids:
            break
        batch_result = _backfill_trace_batch(db, trace_ids)
        for key in ("processed", "matched", "unmatched", "projects_updated"):
            totals[key] += batch_result[key]
        skipped_ids.update(batch_result["unmatched_trace_ids"])
        batch_count += 1
    totals["remaining"] = count_unresolved_registry_traces(db)
    logger.info("registry backfill completed", extra=totals)
    return totals


def run_registry_backfill(*, batch_size: int = BATCH_SIZE, max_batches: int | None = None) -> dict[str, int]:
    db = SessionLocal()
    try:
        return run_registry_backfill_batches(db, batch_size=batch_size, max_batches=max_batches)
    finally:
        db.close()
