from sqlalchemy import Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EventProcessingMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "event_processing_metrics"
    __table_args__ = (
        Index("ix_event_processing_metrics_consumer_created_at", "consumer_name", "created_at"),
        Index("ix_event_processing_metrics_topic_created_at", "topic", "created_at"),
    )

    consumer_name: Mapped[str] = mapped_column(String(64), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    events_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processing_latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
