from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GuardrailPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "guardrail_policies"
    __table_args__ = (
        Index("ix_guardrail_policies_project_active", "project_id", "is_active"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    policy_type: Mapped[str] = mapped_column(String(64), nullable=False)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    project = relationship("Project", back_populates="guardrail_policies")
    events = relationship("GuardrailEvent", back_populates="policy")
    runtime_events = relationship("GuardrailRuntimeEvent", back_populates="policy")
