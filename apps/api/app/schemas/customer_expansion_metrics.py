from pydantic import Field

from app.schemas.common import APIModel


class CustomerExpansionOrganizationRead(APIModel):
    organization_id: str
    organization_name: str
    first_30_day_volume: int
    current_30_day_volume: int
    expansion_ratio: float
    growth_rate: float
    breakout: bool = Field(
        description="True when the current 30-day telemetry volume exceeds 5x the first 30-day volume."
    )


class SystemCustomerExpansionRead(APIModel):
    average_expansion_ratio: float
    total_platform_growth_pct: float
    breakout_customers: int
    organizations: list[CustomerExpansionOrganizationRead]
