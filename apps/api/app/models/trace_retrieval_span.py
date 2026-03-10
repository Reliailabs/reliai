from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class TraceRetrievalSpan(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "trace_retrieval_spans"
    __table_args__ = (
        UniqueConstraint("trace_id", name="uq_trace_retrieval_spans_trace_id"),
        Index("ix_trace_retrieval_spans_trace_id", "trace_id"),
    )

    trace_id: Mapped[UUID] = mapped_column(ForeignKey("traces.id"), nullable=False)
    retrieval_provider: Mapped[str | None] = mapped_column(String(120))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    chunk_count: Mapped[int | None] = mapped_column(Integer)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    trace = relationship("Trace", back_populates="graph_retrieval_span")
