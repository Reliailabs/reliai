from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class OrgEscalationPolicy(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "org_escalation_policies"

    organization_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    trigger_severity: Mapped[str] = mapped_column(String(32), nullable=False, default="all")
    unacknowledged_after_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    steps = relationship(
        "OrgEscalationPolicyStep",
        back_populates="policy",
        order_by="OrgEscalationPolicyStep.step_number",
        cascade="all, delete-orphan",
    )


class OrgEscalationPolicyStep(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "org_escalation_policy_steps"

    policy_id: Mapped[UUID] = mapped_column(
        ForeignKey("org_escalation_policies.id"),
        nullable=False,
        index=True,
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    target: Mapped[str] = mapped_column(String(512), nullable=False)

    policy = relationship("OrgEscalationPolicy", back_populates="steps")
