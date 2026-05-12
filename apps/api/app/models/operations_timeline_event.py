from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OperationsTimelineEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only audit trail for Operations Center events.

    Rows are inserted once and never updated — the absence of updated_at
    encodes the append-only invariant.  All queries must filter by
    organization_id before any other predicate to maintain tenant isolation.
    """

    __tablename__ = "operations_timeline_events"
    __table_args__ = (
        UniqueConstraint("entry_id", name="uq_operations_timeline_events_entry_id"),
        UniqueConstraint(
            "idempotency_key",
            name="uq_operations_timeline_events_idempotency_key",
        ),
        Index("ix_ote_org_occurred_at", "organization_id", "occurred_at"),
        Index("ix_ote_org_kind", "organization_id", "kind"),
        Index("ix_ote_org_lifecycle_id", "organization_id", "lifecycle_id"),
        Index("ix_ote_org_proposal_id", "organization_id", "proposal_id"),
        Index("ix_ote_org_incident_id", "organization_id", "incident_id"),
        Index("ix_ote_policy_gate_result", "policy_gate_result"),
    )

    entry_id: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    # Soft refs — no FK; events may arrive before lifecycle row commits.
    lifecycle_id: Mapped[str | None] = mapped_column(String(64))
    proposal_id: Mapped[str | None] = mapped_column(String(128))
    incident_id: Mapped[str | None] = mapped_column(String(128))
    severity: Mapped[str | None] = mapped_column(String(16))
    lifecycle_state: Mapped[str | None] = mapped_column(String(32))
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_label: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    policy_gate_result: Mapped[str | None] = mapped_column(String(16))
    evidence_refs: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    # DB CHECK constraint enforces this is always TRUE.
    requires_operator_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
