from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OncallEscalationPolicy(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oncall_escalation_policies"
    __table_args__ = (
        UniqueConstraint("rotation_id", "step_order", name="uq_oncall_escalation_rotation_step"),
    )

    rotation_id: Mapped[UUID] = mapped_column(ForeignKey("oncall_rotations.id"), nullable=False, index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    target_role: Mapped[str] = mapped_column(String(32), nullable=False)
    wait_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default="slack")

    rotation = relationship("OncallRotation", back_populates="escalation_policy_steps")
