from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AutomationRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "automation_rules"
    __table_args__ = (
        Index("ix_automation_rules_project_event_enabled", "project_id", "event_type", "enabled"),
    )

    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    condition_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    action_config: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    rule_source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_actions_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    project = relationship("Project", back_populates="automation_rules")
    action_logs = relationship("ReliabilityActionLog", back_populates="rule")
