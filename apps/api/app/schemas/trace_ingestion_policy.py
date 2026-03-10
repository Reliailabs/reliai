from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class MetadataCardinalityRead(APIModel):
    field_name: str
    unique_values_count: int
    limit_reached: bool


class TraceIngestionPolicyRead(APIModel):
    project_id: UUID
    environment_id: UUID | None
    sampling_success_rate: float
    sampling_error_rate: float
    max_metadata_fields: int
    max_cardinality_per_field: int
    retention_days_success: int
    retention_days_error: int
    created_at: datetime
    sensitive_field_patterns: list[str]
    cardinality_summary: list[MetadataCardinalityRead]


class TraceIngestionPolicyUpdate(BaseModel):
    sampling_success_rate: float = Field(ge=0, le=1)
    sampling_error_rate: float = Field(ge=0, le=1)
    max_metadata_fields: int = Field(ge=1, le=100)
    max_cardinality_per_field: int = Field(ge=1, le=5000)
    retention_days_success: int = Field(ge=1, le=3650)
    retention_days_error: int = Field(ge=1, le=3650)
