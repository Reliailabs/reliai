from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class CustomerExportCreate(BaseModel):
    export_format: str = Field(pattern="^(json|csv|parquet)$")


class CustomerExportRead(APIModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    export_format: str
    status: str
    file_name: str | None
    content_type: str | None
    row_count: int
    content_text: str | None
    completed_at: datetime | None
    failed_at: datetime | None
    error_message: str | None
    created_at: datetime
