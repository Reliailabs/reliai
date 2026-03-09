from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RetrievalSpan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "retrieval_spans"

    trace_id: Mapped[UUID] = mapped_column(
        ForeignKey("traces.id"), nullable=False, unique=True, index=True
    )
    retrieval_latency_ms: Mapped[int | None] = mapped_column(Integer)
    source_count: Mapped[int | None] = mapped_column(Integer)
    top_k: Mapped[int | None] = mapped_column(Integer)
    query_text: Mapped[str | None] = mapped_column(Text)
    retrieved_chunks_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)

    trace = relationship("Trace", back_populates="retrieval_span")
