from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class SDKTelemetryEventCreate(BaseModel):
    sdk_version: str = Field(min_length=1, max_length=64)
    language: str = Field(min_length=1, max_length=32)
    latency_ms: int | None = Field(default=None, ge=0)
    error: bool = False
    retry: bool = False
    environment: str | None = None


class SDKMetricRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    environment_id: UUID | None
    bucket_start: datetime
    sdk_version: str
    language: str
    latency_ms_avg: float | None
    latency_ms_p95: float | None
    error_rate: float | None
    request_count: int
    retry_count: int
    error_count: int
