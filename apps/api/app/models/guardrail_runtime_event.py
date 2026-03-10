from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GuardrailRuntimeEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "guardrail_runtime_events"
    __table_args__ = (
        Index("ix_guardrail_runtime_events_policy_created_at", "policy_id", "created_at"),
        Index("ix_guardrail_runtime_events_trace_id", "trace_id"),
    )

    trace_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    environment_id: Mapped[UUID] = mapped_column(ForeignKey("environments.id"), nullable=False, index=True)
    policy_id: Mapped[UUID] = mapped_column(ForeignKey("guardrail_policies.id"), nullable=False, index=True)
    action_taken: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_model: Mapped[str | None] = mapped_column(String(255))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    policy = relationship("GuardrailPolicy", back_populates="runtime_events")
    environment_ref = relationship("Environment", back_populates="guardrail_runtime_events")
