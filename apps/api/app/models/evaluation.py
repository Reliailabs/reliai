from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Evaluation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint("trace_id", "eval_type", name="uq_evaluations_trace_eval_type"),
    )

    trace_id: Mapped[UUID] = mapped_column(ForeignKey("traces.id"), nullable=False, index=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    eval_type: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    label: Mapped[str | None] = mapped_column(String(32))
    explanation: Mapped[str | None] = mapped_column(Text)
    evaluator_provider: Mapped[str | None] = mapped_column(String(64))
    evaluator_model: Mapped[str | None] = mapped_column(String(128))
    evaluator_version: Mapped[str | None] = mapped_column(String(64))
    raw_result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    trace = relationship("Trace", back_populates="evaluations")
    project = relationship("Project", back_populates="evaluations")
