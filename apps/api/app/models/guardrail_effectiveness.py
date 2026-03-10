from datetime import datetime

from sqlalchemy import DateTime, Float, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GuardrailEffectiveness(Base):
    __tablename__ = "guardrail_effectiveness"
    __table_args__ = (
        PrimaryKeyConstraint("policy_type", "action", name="pk_guardrail_effectiveness"),
    )

    policy_type: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    failure_reduction_rate: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
