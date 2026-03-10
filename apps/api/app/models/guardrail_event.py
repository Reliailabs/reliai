from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GuardrailEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "guardrail_events"

    trace_id: Mapped[UUID] = mapped_column(ForeignKey("traces.id"), nullable=False, index=True)
    policy_id: Mapped[UUID] = mapped_column(ForeignKey("guardrail_policies.id"), nullable=False, index=True)
    action_taken: Mapped[str] = mapped_column(String(32), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    trace = relationship("Trace", back_populates="guardrail_events")
    policy = relationship("GuardrailPolicy", back_populates="events")
