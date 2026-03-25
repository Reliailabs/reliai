from __future__ import annotations

import difflib

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.incident import Incident
from app.models.prompt_version import PromptVersion
from app.models.regression_snapshot import RegressionSnapshot
from app.models.reliability_metric import ReliabilityMetric
from app.models.trace import Trace
from app.services.registry import build_prompt_version_path, get_prompt_version_record
from app.services.authorization import require_project_access
from app.services.auth import OperatorContext

MAX_PROMPT_DIFF_CHARS = 200_000
MAX_PROMPT_DIFF_LINES = 4_000


def _normalized_prompt_content(value: str | None) -> str:
    if value is None:
        return ""
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    normalized = "\n".join(line.rstrip() for line in normalized.split("\n"))
    if len(normalized) > MAX_PROMPT_DIFF_CHARS:
        normalized = normalized[:MAX_PROMPT_DIFF_CHARS]
    return normalized


def _line_diff(*, from_content: str, to_content: str) -> list[dict[str, str]]:
    from_lines = from_content.split("\n")
    to_lines = to_content.split("\n")
    if len(from_lines) > MAX_PROMPT_DIFF_LINES:
        from_lines = from_lines[:MAX_PROMPT_DIFF_LINES]
    if len(to_lines) > MAX_PROMPT_DIFF_LINES:
        to_lines = to_lines[:MAX_PROMPT_DIFF_LINES]

    rows: list[dict[str, str]] = []
    for line in difflib.ndiff(from_lines, to_lines):
        marker = line[:2]
        text = line[2:]
        if marker == "- ":
            rows.append({"type": "removed", "text": text})
        elif marker == "+ ":
            rows.append({"type": "added", "text": text})
        elif marker == "  ":
            rows.append({"type": "unchanged", "text": text})
    return rows


def get_prompt_version_diff(
    db: Session,
    operator: OperatorContext,
    *,
    from_version_id,
    to_version_id,
) -> dict | None:
    from_record = db.scalar(select(PromptVersion).where(PromptVersion.id == from_version_id))
    to_record = db.scalar(select(PromptVersion).where(PromptVersion.id == to_version_id))
    if from_record is None or to_record is None:
        return None
    if from_record.project_id != to_record.project_id:
        return None

    require_project_access(db, operator, from_record.project_id)

    # Prompt versions currently store editable prompt text in notes.
    from_content = _normalized_prompt_content(from_record.notes)
    to_content = _normalized_prompt_content(to_record.notes)

    return {
        "from_version": {
            "id": from_record.id,
            "version": from_record.version,
            "content": from_content,
            "created_at": from_record.created_at,
        },
        "to_version": {
            "id": to_record.id,
            "version": to_record.version,
            "content": to_content,
            "created_at": to_record.created_at,
        },
        "diff": _line_diff(from_content=from_content, to_content=to_content),
    }


def get_prompt_version_detail(db: Session, *, project_id, prompt_version_id) -> dict | None:
    record = get_prompt_version_record(db, project_id=project_id, prompt_version_id=prompt_version_id)
    if record is None:
        return None

    trace_count = int(
        db.scalar(
            select(func.count())
            .select_from(Trace)
            .where(Trace.project_id == project_id, Trace.prompt_version_record_id == record.id)
        )
        or 0
    )
    traces = (
        db.scalars(
            select(Trace)
            .options(
                selectinload(Trace.retrieval_span),
                selectinload(Trace.evaluations),
                selectinload(Trace.prompt_version_record),
                selectinload(Trace.model_version_record),
            )
            .where(Trace.project_id == project_id, Trace.prompt_version_record_id == record.id)
            .order_by(desc(Trace.created_at), desc(Trace.id))
            .limit(8)
        )
        .unique()
        .all()
    )
    regressions = db.scalars(
        select(RegressionSnapshot)
        .where(
            RegressionSnapshot.project_id == project_id,
            RegressionSnapshot.scope_type == "prompt_version",
            RegressionSnapshot.scope_id == record.version,
        )
        .order_by(desc(RegressionSnapshot.detected_at))
        .limit(8)
    ).all()
    candidate_incidents = db.scalars(
        select(Incident)
        .options(selectinload(Incident.project))
        .where(Incident.project_id == project_id)
        .order_by(desc(Incident.started_at))
        .limit(50)
    ).all()
    incidents = [
        incident
        for incident in candidate_incidents
        if (incident.summary_json or {}).get("scope_type") == "prompt_version"
        and (incident.summary_json or {}).get("scope_id") == record.version
    ][:8]
    metrics = db.scalars(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == project_id,
            ReliabilityMetric.scope_type == "prompt_version",
            ReliabilityMetric.scope_id == record.version,
        )
        .order_by(desc(ReliabilityMetric.window_end))
        .limit(12)
    ).all()
    traces_path, regressions_path, incidents_path = build_prompt_version_path(
        project_id=project_id,
        prompt_version_id=record.id,
        version=record.version,
    )
    return {
        "record": record,
        "trace_count": trace_count,
        "recent_traces": traces,
        "recent_regressions": regressions,
        "related_incidents": incidents,
        "recent_reliability_metrics": metrics,
        "traces_path": traces_path,
        "regressions_path": regressions_path,
        "incidents_path": incidents_path,
    }
