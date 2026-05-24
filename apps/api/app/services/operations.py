"""Phase 11.4 — Operations Center read-path service.

Implements the query logic for:
    GET /api/v1/operations/timeline   → list_timeline_events
    GET /api/v1/operations/lifecycles → list_lifecycles

Tenant isolation
----------------
Every query filters by organization_id == operator.active_organization_id
before applying any other predicate.  If the operator has no active
organization, both functions return ([], 0) rather than crashing.

Append-only reads
-----------------
operations_timeline_events and lifecycle_transition_history are never
updated — this service only issues SELECT statements against those tables.
proposal_lifecycle_records is mutable, but this module only reads it.
"""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.lifecycle_transition_history import LifecycleTransitionHistory
from app.models.operations_timeline_event import OperationsTimelineEvent
from app.models.proposal_lifecycle_record import ProposalLifecycleRecord
from app.schemas.operations import (
    LifecycleListQuery,
    LifecycleRead,
    LifecycleStateHistoryRead,
    TimelineEventRead,
    TimelineListQuery,
)
from app.services.auth import OperatorContext


# ── Timeline ──────────────────────────────────────────────────────────────────


def list_timeline_events(
    db: Session,
    operator: OperatorContext,
    query: TimelineListQuery,
) -> tuple[list[TimelineEventRead], int]:
    """Return (items, total) for the operations timeline.

    Filters by the operator's active organization first; all remaining
    predicates are additive.
    """
    org_id: UUID | None = operator.active_organization_id
    if org_id is None:
        return [], 0

    stmt = (
        select(OperationsTimelineEvent)
        .where(OperationsTimelineEvent.organization_id == org_id)
        .order_by(desc(OperationsTimelineEvent.occurred_at))
    )

    if query.kind is not None:
        stmt = stmt.where(OperationsTimelineEvent.kind == query.kind)
    if query.severity is not None:
        stmt = stmt.where(OperationsTimelineEvent.severity == query.severity)
    if query.actor_type is not None:
        stmt = stmt.where(OperationsTimelineEvent.actor_type == query.actor_type)
    if query.lifecycle_state is not None:
        stmt = stmt.where(OperationsTimelineEvent.lifecycle_state == query.lifecycle_state)
    if query.incident_id is not None:
        stmt = stmt.where(OperationsTimelineEvent.incident_id == query.incident_id)
    if query.proposal_id is not None:
        stmt = stmt.where(OperationsTimelineEvent.proposal_id == query.proposal_id)
    if query.project_id is not None:
        stmt = stmt.where(OperationsTimelineEvent.project_id == query.project_id)

    # Count before applying limit so the caller knows the full result set size.
    total: int = db.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    events = list(db.scalars(stmt.limit(query.limit)).all())
    items = [TimelineEventRead.model_validate(e) for e in events]
    return items, total


def get_timeline_event_by_id(
    db: Session,
    operator: OperatorContext,
    entry_id: str,
    project_id: UUID | None = None,
) -> TimelineEventRead | None:
    """Return one timeline event scoped to the operator's active organization."""
    org_id: UUID | None = operator.active_organization_id
    if org_id is None:
        return None

    predicates = [
        OperationsTimelineEvent.entry_id == entry_id,
        OperationsTimelineEvent.organization_id == org_id,
    ]
    if project_id is not None:
        predicates.append(OperationsTimelineEvent.project_id == project_id)

    event = db.scalar(select(OperationsTimelineEvent).where(*predicates))
    if event is None:
        return None
    return TimelineEventRead.model_validate(event)


# ── Lifecycles ────────────────────────────────────────────────────────────────


def list_lifecycles(
    db: Session,
    operator: OperatorContext,
    query: LifecycleListQuery,
) -> tuple[list[LifecycleRead], int]:
    """Return (items, total) for proposal lifecycles with inline state_history.

    state_history is batch-loaded in a single query to avoid N+1 queries.
    """
    org_id: UUID | None = operator.active_organization_id
    if org_id is None:
        return [], 0

    stmt = (
        select(ProposalLifecycleRecord)
        .where(ProposalLifecycleRecord.organization_id == org_id)
        .order_by(desc(ProposalLifecycleRecord.created_at))
    )

    if query.state is not None:
        stmt = stmt.where(ProposalLifecycleRecord.state == query.state)
    if query.proposal_id is not None:
        stmt = stmt.where(ProposalLifecycleRecord.proposal_id == query.proposal_id)

    total: int = db.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    records = list(db.scalars(stmt.limit(query.limit)).all())
    if not records:
        return [], total

    # Batch-load transition history for all lifecycles in one query.
    lifecycle_ids = [r.lifecycle_id for r in records]
    history_rows = list(
        db.scalars(
            select(LifecycleTransitionHistory)
            .where(LifecycleTransitionHistory.lifecycle_id.in_(lifecycle_ids))
            .order_by(LifecycleTransitionHistory.transitioned_at.asc())
        ).all()
    )
    history_by_id: dict[str, list[LifecycleTransitionHistory]] = defaultdict(list)
    for h in history_rows:
        history_by_id[h.lifecycle_id].append(h)

    items = [_build_lifecycle_read(r, history_by_id[r.lifecycle_id]) for r in records]
    return items, total


def get_lifecycle_by_id(
    db: Session,
    operator: OperatorContext,
    lifecycle_id: str,
    project_id: UUID | None = None,
) -> LifecycleRead | None:
    """Return one lifecycle scoped to the operator's active organization."""
    org_id: UUID | None = operator.active_organization_id
    if org_id is None:
        return None

    predicates = [
        ProposalLifecycleRecord.lifecycle_id == lifecycle_id,
        ProposalLifecycleRecord.organization_id == org_id,
    ]
    if project_id is not None:
        predicates.append(ProposalLifecycleRecord.project_id == project_id)

    record = db.scalar(select(ProposalLifecycleRecord).where(*predicates))
    if record is None:
        return None

    history_rows = list(
        db.scalars(
            select(LifecycleTransitionHistory)
            .where(LifecycleTransitionHistory.lifecycle_id == lifecycle_id)
            .order_by(LifecycleTransitionHistory.transitioned_at.asc())
        ).all()
    )
    return _build_lifecycle_read(record, history_rows)


def _build_lifecycle_read(
    record: ProposalLifecycleRecord,
    history: list[LifecycleTransitionHistory],
) -> LifecycleRead:
    return LifecycleRead(
        lifecycle_id=record.lifecycle_id,
        proposal_id=record.proposal_id,
        action_type=record.action_type,
        target_type=record.target_type,
        target_id=record.target_id,
        organization_id=record.organization_id,
        project_id=record.project_id,
        state=record.state,
        # Hardcoded invariants — the DB CHECK constraints also enforce these.
        execution_granted=False,
        requires_operator_review=True,
        operator_email=record.operator_email,
        verification_result_id=record.verification_result_id,
        audit_receipt_id=record.audit_receipt_id,
        failure_reason=record.failure_reason,
        expires_at=record.expires_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
        state_history=[
            LifecycleStateHistoryRead(
                from_state=h.from_state,
                to_state=h.to_state,
                transitioned_at=h.transitioned_at,
                reason=h.reason,
            )
            for h in history
        ],
    )
