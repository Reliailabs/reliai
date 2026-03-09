from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OperatorUser(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "operator_users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    sessions = relationship("OperatorSession", back_populates="operator_user")
    acknowledged_incidents = relationship(
        "Incident",
        foreign_keys="Incident.acknowledged_by_operator_user_id",
        back_populates="acknowledged_by_operator",
    )
    owned_incidents = relationship(
        "Incident",
        foreign_keys="Incident.owner_operator_user_id",
        back_populates="owner_operator",
    )
