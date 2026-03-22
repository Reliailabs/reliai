from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.schemas.common import APIModel


class ConfigPatchItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    from_value: str | float | int | bool | None = Field(alias="from")
    to: str | float | int | bool | None


class ConfigApplyRequest(BaseModel):
    patch: list[ConfigPatchItem]
    source_trace_id: str | None = None
    reason: str | None = None


class ConfigUndoRequest(BaseModel):
    source_trace_id: str | None = None
    reason: str | None = None


class ConfigSnapshotRead(APIModel):
    id: UUID
    organization_id: UUID
    config_json: dict[str, Any]
    created_at: datetime
    created_by: UUID | None
    source_trace_id: str | None
    reason: str | None


class ConfigApplyResponse(APIModel):
    status: str
    config_snapshot: ConfigSnapshotRead
