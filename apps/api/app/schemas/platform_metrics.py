from app.schemas.common import APIModel


class PlatformMetricsRead(APIModel):
    trace_ingest_rate: float
    pipeline_latency: float | None
    processor_failure_rate: float
    warehouse_lag: int
    warehouse_rows: int
    active_partitions: int
    scan_rate: float
    avg_query_latency: float
    archive_backlog: int
    customer_overload_risk: str
