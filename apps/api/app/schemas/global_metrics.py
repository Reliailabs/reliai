from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import APIModel


class GlobalModelReliabilityMetricRead(APIModel):
    metric_name: str
    metric_value: float
    sample_size: int
    updated_at: datetime


class GlobalModelReliabilityRead(APIModel):
    provider: str
    model_name: str
    metrics: list[GlobalModelReliabilityMetricRead]


class GlobalModelReliabilityListResponse(BaseModel):
    items: list[GlobalModelReliabilityRead]
