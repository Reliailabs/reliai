from pydantic import BaseModel


class EvaluationUsagePointRead(BaseModel):
    date: str
    count: int


class EvaluationUsageRead(BaseModel):
    window_days: int
    total: int
    used_today: int
    limit: int | None
    percent_used: float | None
    daily: list[EvaluationUsagePointRead]
