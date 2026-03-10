from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class TraceEvaluation(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "trace_evaluations"
    __table_args__ = (
        UniqueConstraint("trace_id", "evaluation_type", name="uq_trace_evaluations_trace_type"),
        Index("ix_trace_evaluations_trace_id", "trace_id"),
    )

    trace_id: Mapped[UUID] = mapped_column(ForeignKey("traces.id"), nullable=False)
    evaluation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    trace = relationship("Trace", back_populates="graph_evaluations")
