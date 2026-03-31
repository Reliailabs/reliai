from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import APIModel


LimitType = Literal[
    "ingest_global",
    "ingest_project",
    "api_rate",
    "processor_dispatch",
    "sampling",
    "queue_lag",
    "storage",
    "llm_provider",
    "payload_truncation",
]

LimitStatusValue = Literal["ok", "warning", "limited", "delayed"]
LimitSeverity = Literal["info", "warning", "critical"]


class LimitScope(APIModel):
    level: Literal["global", "project", "incident", "trace", "ai_feature"]
    project_id: str | None = None
    incident_id: str | None = None
    trace_id: str | None = None
    feature: Literal["ai_summary", "ai_root_cause", "ai_ticket_draft", "ai_fix_summary"] | None = None


class LimitMetrics(APIModel):
    dropped: int | None = None
    delayed: int | None = None
    rate: float | None = None
    lag_ms: int | None = None
    quota_used_pct: float | None = None
    truncated: int | None = None


class LimitActionable(APIModel):
    primary: str
    secondary: str | None = None


class LimitCTA(APIModel):
    label: str
    href: str
    type: Literal["upgrade", "settings", "docs"]


class LimitStatus(APIModel):
    type: LimitType
    status: LimitStatusValue
    severity: LimitSeverity
    message: str
    scope: LimitScope | None = None
    metrics: LimitMetrics | None = None
    window: Literal["1m", "5m", "15m", "1h"] | None = None
    actionable: LimitActionable | None = None
    is_plan_related: bool | None = None
    cta_priority: Literal["settings_first", "upgrade_first", "none"] | None = None
    cta: LimitCTA | None = None
    cta_secondary: LimitCTA | None = None
    updated_at: datetime


class LimitStatusResponse(BaseModel):
    limits: list[LimitStatus]
