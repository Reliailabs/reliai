import os
from collections.abc import Generator
from datetime import timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["API_KEY_HASH_SECRET"] = "test-secret"
os.environ["AUTH_SESSION_HASH_SECRET"] = "test-session-secret"

from app.db.session import get_db
from app.db import base as _db_base  # noqa: F401
from app.main import app
from app.models.base import Base
from app.processors import automation_processor as automation_processor_module
from app.processors import evaluation_processor as evaluation_processor_module
from app.services import event_stream as event_stream_service
from app.services import external_processors as external_processors_service
from app.services import event_processing_metrics as event_processing_metrics_service
from app.services.trace_warehouse import (
    TraceWarehouseAggregateQuery,
    TraceWarehouseEventRow,
    TraceWarehouseQuery,
)
from app.workers import alerts as alert_worker
from app.workers import deployment_risk_analysis as deployment_risk_worker
from app.workers import deployment_simulation as deployment_simulation_worker
from app.workers import evaluations as evaluation_worker
from app.workers import global_metrics_aggregator as global_metrics_worker
from app.workers import regression_detection as regression_detection_worker
from app.workers import reliability_intelligence as reliability_intelligence_worker
from app.workers import reliability_metrics as reliability_metrics_worker
from app.workers import reliability_recommendations as reliability_recommendations_worker
from app.workers import reliability_sweep as reliability_sweep_worker
from app.workers import scheduler as scheduler_worker
from app.workers import trace_warehouse_consumer as trace_warehouse_consumer_worker


class FakeQueue:
    def __init__(self) -> None:
        self.jobs: list[tuple[object, tuple[object, ...], dict[str, object]]] = []

    def enqueue(self, func, *args, **kwargs):
        self.jobs.append((func, args, kwargs))
        return {"func": func, "args": args, "kwargs": kwargs}

    def enqueue_in(self, delay, func, *args, **kwargs):
        self.jobs.append((func, args, {"delay": delay, **kwargs}))
        return {"func": func, "args": args, "kwargs": kwargs}


class FakeTraceWarehouseClient:
    def __init__(self) -> None:
        self.rows: dict[str, TraceWarehouseEventRow] = {}

    def ensure_schema(self) -> None:
        return None

    def insert_trace_events(self, rows: list[TraceWarehouseEventRow]) -> None:
        for row in rows:
            self.rows[str(row.trace_id)] = row

    def query_trace_events(self, query: TraceWarehouseQuery) -> list[TraceWarehouseEventRow]:
        matches = []
        window_start = (
            query.window_start
            if query.window_start.tzinfo is not None
            else query.window_start.replace(tzinfo=timezone.utc)
        )
        window_end = (
            query.window_end
            if query.window_end.tzinfo is not None
            else query.window_end.replace(tzinfo=timezone.utc)
        )
        for row in self.rows.values():
            timestamp = row.timestamp if row.timestamp.tzinfo is not None else row.timestamp.replace(tzinfo=timezone.utc)
            if row.organization_id != query.organization_id or row.project_id != query.project_id:
                continue
            if query.environment_id is not None and row.environment_id != query.environment_id:
                continue
            if timestamp < window_start or timestamp >= window_end:
                continue
            if query.prompt_version_id is not None and row.prompt_version_id != str(query.prompt_version_id):
                continue
            if query.model_version_id is not None and row.model_version_id != query.model_version_id:
                continue
            metadata = row.metadata_json or {}
            if query.prompt_version is not None and metadata.get("__prompt_version") != query.prompt_version:
                continue
            if (
                query.model_name is not None
                and row.model_family != query.model_name
                and metadata.get("__model_name") != query.model_name
            ):
                continue
            if query.latency_min_ms is not None and (row.latency_ms is None or row.latency_ms < query.latency_min_ms):
                continue
            if query.latency_max_ms is not None and (row.latency_ms is None or row.latency_ms > query.latency_max_ms):
                continue
            if query.success is not None and row.success != query.success:
                continue
            if (
                query.structured_output_valid is not None
                and row.structured_output_valid != query.structured_output_valid
            ):
                continue
            matches.append(row)
        matches.sort(key=lambda item: (item.timestamp, str(item.trace_id)), reverse=True)
        if query.limit is not None:
            return matches[: query.limit]
        return matches

    def aggregate_trace_metrics(self, query: TraceWarehouseAggregateQuery) -> dict[str, object]:
        rows = self.query_trace_events(
            TraceWarehouseQuery(
                organization_id=query.organization_id,
                project_id=query.project_id,
                window_start=query.window_start,
                window_end=query.window_end,
                prompt_version_id=query.prompt_version_id,
                model_version_id=query.model_version_id,
                prompt_version=query.prompt_version,
                model_name=query.model_name,
                latency_min_ms=query.latency_min_ms,
                latency_max_ms=query.latency_max_ms,
                success=query.success,
                structured_output_valid=query.structured_output_valid,
            )
        )
        if not rows:
            return {
                "trace_count": 0,
                "success_rate": None,
                "error_rate": None,
                "average_latency_ms": None,
                "structured_output_validity_rate": None,
                "average_cost_usd": None,
            }
        success_rate = sum(1 for row in rows if row.success) / len(rows)
        latencies = [row.latency_ms for row in rows if row.latency_ms is not None]
        structured = [row.structured_output_valid for row in rows if row.structured_output_valid is not None]
        costs = [float(row.cost) for row in rows if row.cost is not None]
        return {
            "trace_count": len(rows),
            "success_rate": success_rate,
            "error_rate": 1 - success_rate,
            "average_latency_ms": sum(latencies) / len(latencies) if latencies else None,
            "structured_output_validity_rate": (
                sum(1 for value in structured if value) / len(structured) if structured else None
            ),
            "average_cost_usd": sum(costs) / len(costs) if costs else None,
        }

    def query_all_trace_events(self, *, window_start, window_end, limit=None):
        matches = []
        start = window_start if window_start.tzinfo is not None else window_start.replace(tzinfo=timezone.utc)
        end = window_end if window_end.tzinfo is not None else window_end.replace(tzinfo=timezone.utc)
        for row in self.rows.values():
            timestamp = row.timestamp if row.timestamp.tzinfo is not None else row.timestamp.replace(tzinfo=timezone.utc)
            if timestamp < start or timestamp >= end:
                continue
            matches.append(row)
        matches.sort(key=lambda item: (item.timestamp, str(item.trace_id)), reverse=True)
        if limit is not None:
            return matches[:limit]
        return matches


@pytest.fixture
def fake_event_stream(monkeypatch: pytest.MonkeyPatch) -> event_stream_service.InMemoryEventStreamClient:
    client = event_stream_service.InMemoryEventStreamClient()
    monkeypatch.setattr(event_stream_service, "get_event_stream_client", lambda: client)
    return client


class BorrowedSession:
    def __init__(self, session: Session) -> None:
        self._session = session

    def __getattr__(self, name: str):
        return getattr(self._session, name)

    def close(self) -> None:
        return None


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def patch_event_processing_metrics_session(
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> None:
    monkeypatch.setattr(
        event_processing_metrics_service,
        "SessionLocal",
        lambda: BorrowedSession(db_session),
    )
    monkeypatch.setattr(
        external_processors_service,
        "SessionLocal",
        lambda: BorrowedSession(db_session),
    )


@pytest.fixture
def fake_queue(monkeypatch: pytest.MonkeyPatch) -> FakeQueue:
    queue = FakeQueue()
    monkeypatch.setattr(evaluation_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(deployment_risk_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(deployment_simulation_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(alert_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(reliability_metrics_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(global_metrics_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(reliability_intelligence_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(reliability_recommendations_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(scheduler_worker, "get_queue", lambda: queue)
    monkeypatch.setattr(reliability_sweep_worker, "enqueue_alert_delivery_jobs", lambda ids: [queue.enqueue(alert_worker.run_alert_delivery, str(item)) for item in ids])
    return queue


@pytest.fixture
def fake_trace_warehouse(
    monkeypatch: pytest.MonkeyPatch,
    db_session: Session,
) -> FakeTraceWarehouseClient:
    from app.services import trace_warehouse as trace_warehouse_service

    client = FakeTraceWarehouseClient()
    monkeypatch.setattr(trace_warehouse_service, "get_trace_warehouse_client", lambda: client)
    monkeypatch.setattr(automation_processor_module, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(evaluation_processor_module, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(evaluation_worker, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(reliability_metrics_worker, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(regression_detection_worker, "SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr(trace_warehouse_consumer_worker, "SessionLocal", lambda: BorrowedSession(db_session))
    return client
