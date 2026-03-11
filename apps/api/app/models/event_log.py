from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class EventLog(Base):
    __tablename__ = "event_log"
    __table_args__ = (
        Index("ix_event_log_project_timestamp", "project_id", "timestamp"),
        Index("ix_event_log_type_timestamp", "event_type", "timestamp"),
        Index("ix_event_log_trace_timestamp", "trace_id", "timestamp"),
    )

    event_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    organization_id: Mapped[UUID | None] = mapped_column(Uuid, index=True)
    project_id: Mapped[UUID | None] = mapped_column(Uuid, index=True)
    trace_id: Mapped[str | None] = mapped_column(Text, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
