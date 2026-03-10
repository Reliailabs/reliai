from pydantic import Field

from app.schemas.common import APIModel


class GrowthDailyPointRead(APIModel):
    date: str
    count: int


class GrowthTraceVolumeRead(APIModel):
    today: int
    seven_day_avg: int
    growth_pct: int
    daily_points: list[GrowthDailyPointRead]


class GrowthIncidentMetricsRead(APIModel):
    incidents_detected: int
    avg_mttr_minutes: int
    daily_points: list[GrowthDailyPointRead]


class GrowthGuardrailMetricsRead(APIModel):
    retries: int
    fallbacks: int
    blocks: int


class GrowthUsageTiersRead(APIModel):
    under_1m: int
    one_to_ten_m: int = Field(alias="1m_10m")
    ten_to_hundred_m: int = Field(alias="10m_100m")
    hundred_m_plus: int = Field(alias="100m_plus")


class SystemGrowthRead(APIModel):
    trace_volume: GrowthTraceVolumeRead
    incident_metrics: GrowthIncidentMetricsRead
    guardrail_metrics: GrowthGuardrailMetricsRead
    usage_tiers: GrowthUsageTiersRead
