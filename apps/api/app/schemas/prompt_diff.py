from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class PromptDiffVersionRead(BaseModel):
    id: UUID
    version: str
    content: str
    created_at: datetime


class PromptDiffLineRead(BaseModel):
    type: Literal["added", "removed", "unchanged"]
    text: str


class PromptDiffRead(BaseModel):
    from_version: PromptDiffVersionRead
    to_version: PromptDiffVersionRead
    diff: list[PromptDiffLineRead]
