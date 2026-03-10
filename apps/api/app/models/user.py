from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    legacy_operator_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("operator_users.id"), unique=True, index=True
    )
    workos_user_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_system_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    memberships = relationship("OrganizationMember", back_populates="user")
    project_memberships = relationship("ProjectMember", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
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
    incident_events = relationship(
        "IncidentEvent",
        foreign_keys="IncidentEvent.actor_operator_user_id",
        back_populates="actor_operator_user",
    )
