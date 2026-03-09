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
