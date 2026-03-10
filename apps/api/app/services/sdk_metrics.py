from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sdk_metric import SDKMetric


def _bucket_start(timestamp: datetime) -> datetime:
    value = timestamp.astimezone(timezone.utc) if timestamp.tzinfo is not None else timestamp.replace(tzinfo=timezone.utc)
    return value.replace(minute=0, second=0, microsecond=0)


def record_sdk_event(db: Session, payload: dict) -> SDKMetric:
    timestamp = datetime.fromisoformat(str(payload["timestamp"]))
    bucket_start = _bucket_start(timestamp)
    environment_id = payload.get("environment_id")
    metric = db.scalar(
        select(SDKMetric).where(
            SDKMetric.organization_id == UUID(str(payload["organization_id"])),
            SDKMetric.project_id == UUID(str(payload["project_id"])),
            SDKMetric.environment_id == (UUID(str(environment_id)) if environment_id else None),
            SDKMetric.bucket_start == bucket_start,
            SDKMetric.sdk_version == str(payload["sdk_version"]),
            SDKMetric.language == str(payload["language"]),
        )
    )
    if metric is None:
        metric = SDKMetric(
            organization_id=UUID(str(payload["organization_id"])),
            project_id=UUID(str(payload["project_id"])),
            environment_id=UUID(str(environment_id)) if environment_id else None,
            bucket_start=bucket_start,
            sdk_version=str(payload["sdk_version"]),
            language=str(payload["language"]),
            request_count=0,
            retry_count=0,
            error_count=0,
        )
        db.add(metric)
        db.flush()

    metric.request_count += 1
    if payload.get("retry"):
        metric.retry_count += 1
    if payload.get("error"):
        metric.error_count += 1
    latencies = [value for value in [metric.latency_ms_avg, payload.get("latency_ms")] if value is not None]
    if latencies:
        metric.latency_ms_avg = round(sum(float(value) for value in latencies) / len(latencies), 2)
        metric.latency_ms_p95 = max(float(value) for value in latencies)
    metric.error_rate = round(metric.error_count / metric.request_count, 4) if metric.request_count else 0.0
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric
