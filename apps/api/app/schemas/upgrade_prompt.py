from pydantic import BaseModel

from app.schemas.common import APIModel


class UpgradePromptRead(APIModel):
    title: str
    message: str
    cta: str
    plan: str


class UsageStatusRead(APIModel):
    used: int
    limit: int | None
    percent_used: float
    status: str


class UpgradeRequiredResponse(BaseModel):
    error: str = "upgrade_required"
    upgrade_prompt: UpgradePromptRead
