from app.schemas.common import APIModel


class PlatformMetricsRead(APIModel):
    trace_ingest_rate: float
    pipeline_latency: float | None
    processor_failure_rate: float
    warehouse_lag: int
    customer_overload_risk: str
