from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LifecycleTransitionHistory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only state-transition audit log for proposal lifecycles.

    lifecycle_id is a soft ref (no FK) — transition rows may be written in
    the same transaction as the lifecycle row, before it commits.  Rows are
    never updated; the absence of updated_at encodes the append-only invariant.
    """

    __tablename__ = "lifecycle_transition_history"
    __table_args__ = (
        UniqueConstraint(
            "idempotency_key",
            name="uq_lifecycle_transition_history_idempotency_key",
        ),
        Index("ix_lth_lifecycle_id", "lifecycle_id"),
        Index("ix_lth_org_to_state", "organization_id", "to_state"),
    )

    # Soft ref — intentionally no ForeignKey to avoid write-order coupling.
    lifecycle_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    from_state: Mapped[str] = mapped_column(String(32), nullable=False)
    to_state: Mapped[str] = mapped_column(String(32), nullable=False)
    transitioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
