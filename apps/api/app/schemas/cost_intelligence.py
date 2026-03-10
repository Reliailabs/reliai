from app.schemas.common import APIModel


class CostByModelRead(APIModel):
    model: str
    trace_count: int
    total_cost_usd: float
    average_cost_usd: float


class DailyCostPointRead(APIModel):
    date: str
    total_cost_usd: float


class CostAnomalyRead(APIModel):
    date: str
    total_cost_usd: float
    deviation_pct: float


class ProjectCostRead(APIModel):
    cost_per_trace: float
    daily_cost: list[DailyCostPointRead]
    cost_per_model: list[CostByModelRead]
    cost_anomalies: list[CostAnomalyRead]
