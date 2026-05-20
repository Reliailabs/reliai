"""Phase 11.4 — Operations Center read-path schemas.

These schemas define the response shapes for:
    GET /api/v1/operations/timeline
    GET /api/v1/operations/lifecycles
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


# ── Query parameters ──────────────────────────────────────────────────────────


class TimelineListQuery(BaseModel):
    """Filter parameters for GET /api/v1/operations/timeline.

    All fields are optional; unset fields are not applied as filters.
    """

    kind: str | None = None
    severity: str | None = Field(
        default=None, pattern=r"^(critical|high|medium|low)$"
    )
    actor_type: str | None = Field(default=None, pattern=r"^(human|system)$")
    lifecycle_state: str | None = None
    incident_id: str | None = None
    proposal_id: str | None = None
    project_id: UUID | None = None
    limit: int = Field(default=50, ge=1, le=200)


class LifecycleListQuery(BaseModel):
    """Filter parameters for GET /api/v1/operations/lifecycles."""

    state: str | None = None
    proposal_id: str | None = None
    limit: int = Field(default=50, ge=1, le=200)


# ── Response schemas ──────────────────────────────────────────────────────────


class TimelineEventRead(APIModel):
    """Single operations timeline event — maps from OperationsTimelineEvent."""

    entry_id: str
    kind: str
    occurred_at: datetime
    organization_id: UUID
    project_id: UUID | None
    lifecycle_id: str | None
    proposal_id: str | None
    incident_id: str | None
    severity: str | None
    lifecycle_state: str | None
    actor_type: str
    actor_label: str
    title: str
    summary: str
    policy_gate_result: str | None
    evidence_refs: list[dict[str, Any]]
    requires_operator_review: bool


class TimelineListResponse(BaseModel):
    items: list[TimelineEventRead]
    total: int


class LifecycleStateHistoryRead(BaseModel):
    """State transition entry from lifecycle_transition_history."""

    from_state: str
    to_state: str
    transitioned_at: datetime
    reason: str | None


class LifecycleRead(BaseModel):
    """Full lifecycle record, including inline state_history.

    Not an APIModel because state_history is loaded from a separate table
    and constructed manually in the service layer.
    """

    lifecycle_id: str
    proposal_id: str
    action_type: str
    target_type: str
    target_id: str
    organization_id: UUID
    project_id: UUID | None
    state: str
    execution_granted: bool
    requires_operator_review: bool
    operator_email: str | None
    verification_result_id: str | None
    audit_receipt_id: str | None
    failure_reason: str | None
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    state_history: list[LifecycleStateHistoryRead]


class LifecycleListResponse(BaseModel):
    items: list[LifecycleRead]
    total: int
