from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import APIModel


class ProjectCustomMetricCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    metric_type: str = Field(pattern=r"^(regex|keyword)$")
    value_mode: str = Field(pattern=r"^(boolean|count)$")
    pattern: str | None = Field(default=None, max_length=500)
    keywords: list[str] | None = None
    enabled: bool = True
    metadata_json: dict[str, Any] | None = None

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [item.strip() for item in value if item and item.strip()]
        if len(cleaned) == 0:
            return None
        if len(cleaned) > 20:
            raise ValueError("keywords supports at most 20 values")
        return cleaned

    @model_validator(mode="after")
    def validate_definition(self) -> "ProjectCustomMetricCreate":
        if self.metric_type == "regex" and not self.pattern:
            raise ValueError("regex metrics require pattern")
        if self.metric_type == "keyword" and not self.keywords:
            raise ValueError("keyword metrics require keywords")
        return self


class ProjectCustomMetricUpdate(BaseModel):
    enabled: bool


class ProjectCustomMetricRead(APIModel):
    id: UUID
    project_id: UUID
    name: str
    metric_key: str
    metric_type: str
    value_mode: str
    pattern: str | None
    keywords_json: list[str] | None
    enabled: bool
    metadata_json: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class ProjectCustomMetricListResponse(BaseModel):
    items: list[ProjectCustomMetricRead]
