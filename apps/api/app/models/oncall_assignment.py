from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OncallAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oncall_assignments"
    __table_args__ = (
        UniqueConstraint("rotation_id", "role", name="uq_oncall_assignments_rotation_role"),
    )

    rotation_id: Mapped[UUID] = mapped_column(ForeignKey("oncall_rotations.id"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rotation = relationship("OncallRotation", back_populates="assignments")
    user = relationship("User")
