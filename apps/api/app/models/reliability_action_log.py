from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReliabilityActionLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reliability_action_logs"
    __table_args__ = (
        Index("ix_reliability_action_logs_project_created_at", "project_id", "created_at"),
        Index("ix_reliability_action_logs_rule_created_at", "rule_id", "created_at"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    rule_id: Mapped[UUID | None] = mapped_column(ForeignKey("automation_rules.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    detail_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project = relationship("Project", back_populates="reliability_action_logs")
    rule = relationship("AutomationRule", back_populates="action_logs")
