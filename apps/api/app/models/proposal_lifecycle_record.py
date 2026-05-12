from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProposalLifecycleRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Mutable record tracking a proposal lifecycle from detection to completion.

    State transitions are applied as UPDATE on this row + INSERT into
    lifecycle_transition_history.  Two DB-level CHECK constraints are in the
    Alembic migration:
        CHECK (execution_granted = FALSE)
        CHECK (requires_operator_review = TRUE)
    These prevent any code path from accidentally setting these fields to
    values that would violate the governance boundary.
    """

    __tablename__ = "proposal_lifecycle_records"
    __table_args__ = (
        UniqueConstraint("lifecycle_id", name="uq_proposal_lifecycle_records_lifecycle_id"),
        UniqueConstraint(
            "idempotency_key",
            name="uq_proposal_lifecycle_records_idempotency_key",
        ),
        Index("ix_plr_org_state", "organization_id", "state"),
        Index("ix_plr_org_proposal_id", "organization_id", "proposal_id"),
    )

    lifecycle_id: Mapped[str] = mapped_column(String(64), nullable=False)
    proposal_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(128), nullable=False)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    state: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # DB CHECK constraint enforces execution_granted = FALSE always.
    execution_granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # DB CHECK constraint enforces requires_operator_review = TRUE always.
    requires_operator_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    operator_email: Mapped[str | None] = mapped_column(String(255))
    # Soft ref — set after verification is recorded.
    verification_result_id: Mapped[str | None] = mapped_column(String(128))
    audit_receipt_id: Mapped[str | None] = mapped_column(String(128))
    failure_reason: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
