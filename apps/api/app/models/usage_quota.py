from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UsageQuota(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "usage_quotas"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, unique=True, index=True
    )
    max_traces_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_processors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_api_requests: Mapped[int | None] = mapped_column(Integer, nullable=True)

    organization = relationship("Organization", back_populates="usage_quota")
