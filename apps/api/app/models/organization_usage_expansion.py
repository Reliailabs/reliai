from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OrganizationUsageExpansion(Base):
    __tablename__ = "organization_usage_expansion"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        primary_key=True,
    )
    first_30_day_traces: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_30_day_traces: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expansion_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    breakout_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    organization = relationship("Organization")
