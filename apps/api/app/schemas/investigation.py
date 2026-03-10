from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.schemas.common import APIModel


class RootCauseHintRead(APIModel):
    hint_type: str
    dimension: str
    current_value: str | None
    baseline_value: str | None
    current_count: int | None
    baseline_count: int | None
    current_share: Decimal | None
    baseline_share: Decimal | None
    current_metric_value: Decimal | None
    baseline_metric_value: Decimal | None
    cluster_started_at: datetime | None
    supporting_trace_ids: list[UUID] = []
    metadata_json: dict[str, Any] | None


class DimensionSummaryRead(APIModel):
    summary_type: str
    dimension: str
    current_value: str | None
    baseline_value: str | None
    current_count: int | None
    baseline_count: int | None
    current_share: Decimal | None
    baseline_share: Decimal | None
    delta_value: Decimal | None
    metadata_json: dict[str, Any] | None


class CohortPivotRead(APIModel):
    pivot_type: str
    label: str
    path: str
    query_params: dict[str, str]


class TraceDiffBlockRead(APIModel):
    block_type: str
    title: str
    changed: bool
    current_value: str | None
    baseline_value: str | None
    metadata_json: dict[str, Any] | None


class PromptVersionContextRead(APIModel):
    id: UUID
    project_id: UUID
    version: str
    label: str | None
    current_count: int | None
    baseline_count: int | None
    traces_path: str
    regressions_path: str
    incidents_path: str


class ModelVersionContextRead(APIModel):
    id: UUID
    project_id: UUID
    provider: str | None
    model_name: str
    model_version: str | None
    route_key: str | None
    label: str | None
    current_count: int | None
    baseline_count: int | None
    traces_path: str
