from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.trace import TraceListItemRead


class TraceCohortFilters(BaseModel):
    prompt_version_id: UUID | None = None
    model_version_id: UUID | None = None
    latency_min_ms: int | None = Field(default=None, ge=0)
    latency_max_ms: int | None = Field(default=None, ge=0)
    success: bool | None = None
    structured_output_valid: bool | None = None
    date_from: datetime
    date_to: datetime

    @model_validator(mode="after")
    def validate_window(self) -> "TraceCohortFilters":
        if self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        if self.latency_min_ms is not None and self.latency_max_ms is not None:
            if self.latency_min_ms > self.latency_max_ms:
                raise ValueError("latency_min_ms must be before or equal to latency_max_ms")
        return self


class TraceCohortAggregation(BaseModel):
    sample_limit: int = Field(default=25, ge=1, le=100)


class TraceCohortRequest(BaseModel):
    filters: TraceCohortFilters
    aggregation: TraceCohortAggregation = TraceCohortAggregation()


class TraceCohortMetricsRead(BaseModel):
    trace_count: int
    error_rate: float | None
    average_latency_ms: float | None
    structured_output_validity: float | None
    average_cost_usd: float | None


class TraceCohortResponse(BaseModel):
    project_id: UUID
    backend: Literal["postgres", "warehouse"]
    metrics: TraceCohortMetricsRead
    items: list[TraceListItemRead]
