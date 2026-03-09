from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OperatorSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "operator_sessions"

    operator_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("operator_users.id"), nullable=False, index=True
    )
    session_token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    operator_user = relationship("OperatorUser", back_populates="sessions")
