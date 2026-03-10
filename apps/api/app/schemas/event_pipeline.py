from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import APIModel


class EventPipelineConsumerRead(APIModel):
    consumer_name: str
    topic: str
    health: str
    processing_rate_per_minute: float
    lag: int
    processed_events_total: int
    processed_events_recent: int
    error_count_total: int
    error_count_recent: int
    average_processing_latency_ms: float | None
    last_processed_at: datetime | None
    last_error_at: datetime | None


class EventPipelineRead(APIModel):
    topic: str
    dead_letter_topic: str | None
    total_events_published: int
    recent_events_published: int
    window_minutes: int
    consumers: list[EventPipelineConsumerRead]


class EventPipelineResponse(BaseModel):
    pipeline: EventPipelineRead
