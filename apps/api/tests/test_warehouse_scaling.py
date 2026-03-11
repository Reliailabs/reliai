from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException, status

from app.models.environment import Environment
from app.models.trace import Trace
from app.services.clickhouse_migrations import apply_migrations, get_current_version
from app.services.cost_intelligence import get_project_cost_intelligence
from app.services.growth_metrics import get_growth_metrics
from app.services.trace_query_router import (
    TraceQueryRequest,
    query_daily_metrics,
    query_hourly_metrics,
    query_recent_traces,
    query_rollups_via_router,
    route_trace_query,
)
from app.services.trace_warehouse import (
    _aggregate_trace_metrics,
    TraceWarehouseAggregateQuery,
    TraceWarehouseEventRow,
    TraceWarehouseQuery,
    WarehouseQueryViolation,
    contextvar_router_active,
)
from app.workers.warehouse_archiver import run_warehouse_archiver

from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_clickhouse_migrations_apply_in_order(monkeypatch):
    executed: list[str] = []
    state = {"versions": []}

    def fake_post(sql: str) -> str:
        compact = " ".join(sql.split())
        if "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1" in compact:
            return f"{state['versions'][-1]}\n" if state["versions"] else ""
        if "SELECT version FROM schema_migrations FORMAT TSV" in compact:
            return "\n".join(state["versions"])
        if "INSERT INTO schema_migrations FORMAT Values" in compact:
            version = sql.split("('", 1)[1].split("'", 1)[0]
            state["versions"].append(version)
            return ""
        executed.append(compact)
        return ""

    monkeypatch.setattr("app.services.clickhouse_migrations._post_sql", fake_post)
    monkeypatch.setattr("app.services.clickhouse_migrations.get_settings", lambda: type("S", (), {"trace_warehouse_url": "http://warehouse", "clickhouse_database": "reliai", "clickhouse_migrations_dir": "infra/clickhouse/migrations"})())

    applied = apply_migrations()

    assert applied == ["001", "002", "003"]
    assert get_current_version() == "003"
    assert any("CREATE TABLE IF NOT EXISTS trace_warehouse" in sql for sql in executed)


def test_query_router_prefers_rollups_and_archive():
    now = datetime.now(timezone.utc)
    assert route_trace_query(TraceQueryRequest(window_start=now - timedelta(hours=1), window_end=now)) == "warehouse"
    assert (
        route_trace_query(
            TraceQueryRequest(window_start=now - timedelta(days=2), window_end=now, aggregated=True)
        )
        == "rollup_hourly"
    )
    assert (
        route_trace_query(
            TraceQueryRequest(window_start=now - timedelta(days=45), window_end=now, aggregated=True)
        )
        == "rollup_daily"
    )
    assert route_trace_query(TraceQueryRequest(window_start=now - timedelta(days=45), window_end=now)) == "archive"


def test_router_uses_hourly_rollups(fake_trace_warehouse):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    route, rows = query_rollups_via_router(
        project_id=None,
        environment_id=None,
        window_start=now - timedelta(days=7),
        window_end=now,
    )

    assert route == "rollup_hourly"
    assert rows == []


def test_router_uses_daily_rollups(fake_trace_warehouse):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    route, rows = query_rollups_via_router(
        project_id=None,
        environment_id=None,
        window_start=now - timedelta(days=60),
        window_end=now,
    )

    assert route == "rollup_daily"
    assert rows == []


def test_event_scan_guard(client, db_session, fake_queue, fake_trace_warehouse):
    operator = create_operator(db_session, email="warehouse-guard@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Warehouse Guard Org", slug="warehouse-guard-org")
    project = create_project(client, session_payload, organization["id"])

    with pytest.raises(WarehouseQueryViolation):
        query_recent_traces(
            TraceWarehouseQuery(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                window_start=datetime.now(timezone.utc) - timedelta(days=2),
                window_end=datetime.now(timezone.utc),
            )
        )


def test_aggregate_trace_metrics_guard(client, db_session):
    operator = create_operator(db_session, email="warehouse-aggregate-guard@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Warehouse Aggregate Org", slug="warehouse-aggregate-org")
    project = create_project(client, session_payload, organization["id"])

    token = contextvar_router_active.set(True)
    try:
        with pytest.raises(WarehouseQueryViolation):
            _aggregate_trace_metrics(
                TraceWarehouseAggregateQuery(
                    organization_id=UUID(organization["id"]),
                    project_id=UUID(project["id"]),
                    window_start=datetime.now(timezone.utc) - timedelta(days=2),
                    window_end=datetime.now(timezone.utc),
                )
            )
    finally:
        contextvar_router_active.reset(token)


def test_router_rollup_boundary():
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    assert route_trace_query(
        TraceQueryRequest(window_start=now - timedelta(hours=24), window_end=now, aggregated=True)
    ) == "warehouse"
    assert route_trace_query(
        TraceQueryRequest(window_start=now - timedelta(hours=25), window_end=now, aggregated=True)
    ) == "rollup_hourly"


def test_hourly_rollup_query(fake_trace_warehouse):
    project_id = UUID("00000000-0000-0000-0000-000000000101")
    environment_id = UUID("00000000-0000-0000-0000-000000000202")
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    fake_trace_warehouse.insert_trace_events(
        [
            TraceWarehouseEventRow(
                timestamp=now - timedelta(days=3, minutes=15),
                organization_id=UUID("00000000-0000-0000-0000-000000000001"),
                project_id=project_id,
                environment_id=environment_id,
                trace_id=UUID("00000000-0000-0000-0000-000000000301"),
                model_family="gpt-4.1",
                latency_ms=320,
                success=True,
                input_tokens=20,
                output_tokens=10,
                metadata_json={},
            ),
            TraceWarehouseEventRow(
                timestamp=now - timedelta(days=3, minutes=5),
                organization_id=UUID("00000000-0000-0000-0000-000000000001"),
                project_id=project_id,
                environment_id=environment_id,
                trace_id=UUID("00000000-0000-0000-0000-000000000302"),
                model_family="gpt-4.1",
                latency_ms=280,
                success=False,
                input_tokens=10,
                output_tokens=10,
                metadata_json={},
            ),
        ]
    )

    rows = query_hourly_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=now - timedelta(days=7),
        end_time=now,
    )

    assert rows
    assert rows[0].trace_count == 2


def test_daily_rollup_query(fake_trace_warehouse):
    project_id = UUID("00000000-0000-0000-0000-000000000111")
    environment_id = UUID("00000000-0000-0000-0000-000000000222")
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    fake_trace_warehouse.insert_trace_events(
        [
            TraceWarehouseEventRow(
                timestamp=now - timedelta(days=40),
                organization_id=UUID("00000000-0000-0000-0000-000000000001"),
                project_id=project_id,
                environment_id=environment_id,
                trace_id=UUID("00000000-0000-0000-0000-000000000311"),
                model_family="gpt-4.1",
                latency_ms=500,
                success=True,
                input_tokens=15,
                output_tokens=15,
                metadata_json={},
            )
        ]
    )

    rows = query_daily_metrics(
        project_id=project_id,
        environment_id=environment_id,
        start_time=now - timedelta(days=60),
        end_time=now,
    )

    assert rows
    assert rows[0].trace_count == 1


def test_scheduler_status_endpoint_requires_admin(client, db_session):
    viewer = create_operator(db_session, email="viewer@acme.test")
    admin = create_operator(db_session, email="admin@acme.test", is_system_admin=True)
    viewer_session = sign_in(client, email=viewer.email)
    admin_session = sign_in(client, email=admin.email)

    forbidden = client.get("/api/v1/system/scheduler", headers=auth_headers(viewer_session))
    allowed = client.get("/api/v1/system/scheduler", headers=auth_headers(admin_session))

    assert forbidden.status_code == 403
    assert allowed.status_code == 200
    assert {item["job_name"] for item in allowed.json()["jobs"]} >= {
        "reliability_pattern_mining",
        "data_retention_worker",
        "platform_monitor",
    }


def test_archive_worker_reports_status(client, db_session):
    class BorrowedSession:
        def __init__(self, session):
            self._session = session

        def __getattr__(self, name):
            return getattr(self._session, name)

        def close(self):
            return None

    from app.workers import warehouse_archiver as warehouse_archiver_worker

    admin = create_operator(db_session, email="archive-admin@acme.test", is_system_admin=True)
    session = sign_in(client, email=admin.email)
    organization = create_organization(client, session, name="Archive Org", slug="archive-org")
    project = create_project(client, session, organization["id"])
    environment = db_session.query(Environment).filter(Environment.project_id == UUID(project["id"])).first()
    assert environment is not None

    stale = Trace(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment_id=environment.id,
        environment="production",
        timestamp=datetime.now(timezone.utc) - timedelta(days=45),
        request_id="req-archive",
        created_at=datetime.now(timezone.utc) - timedelta(days=45),
        model_name="gpt-4.1",
        success=True,
    )
    db_session.add(stale)
    db_session.commit()

    warehouse_archiver_worker.SessionLocal = lambda: BorrowedSession(db_session)
    run_warehouse_archiver()
    response = client.get("/api/v1/system/archive-status", headers=auth_headers(session))

    assert response.status_code == 200
    assert response.json()["archived_partitions"] >= 1


def test_trace_ingest_backpressure_samples_events(
    client,
    db_session,
    fake_event_stream,
    monkeypatch,
):
    operator = create_operator(db_session, email="backpressure@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Backpressure Org", slug="backpressure-org")
    project = create_project(client, session, organization["id"])
    api_key = create_api_key(client, session, project["id"])

    def reject_rate_limit(*args, **kwargs):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    monkeypatch.setattr("app.services.traces.enforce_rate_limit", reject_rate_limit)

    ingest_trace(
        client,
        api_key["api_key"],
        {
            "project_id": project["id"],
            "environment": "production",
            "request_id": "req-overload",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": "gpt-4.1",
            "success": True,
        },
    )

    assert any(message.payload["event_type"] == "pipeline_backpressure" for message in fake_event_stream.consume("trace_events"))


def test_switch_organization_updates_active_scope(client, db_session):
    operator = create_operator(db_session, email="switcher@acme.test")
    session = sign_in(client, email=operator.email)
    create_organization(client, session, name="Acme", slug="acme")
    second = create_organization(client, session, name="Beta", slug="beta")

    response = client.post(
        "/api/v1/auth/switch-organization",
        headers=auth_headers(session),
        json={"organization_id": second["id"]},
    )

    assert response.status_code == 200
    assert response.json()["active_organization_id"] == second["id"]
    assert {item["organization_name"] for item in response.json()["memberships"]} >= {"Acme", "Beta"}


def test_membership_admin_endpoints_require_org_admin(client, db_session):
    admin = create_operator(db_session, email="org-admin@acme.test")
    member = create_operator(db_session, email="member@acme.test")
    outsider = create_operator(db_session, email="outsider@acme.test")
    admin_session = sign_in(client, email=admin.email)
    outsider_session = sign_in(client, email=outsider.email)
    organization = create_organization(client, admin_session, name="Members Org", slug="members-org")
    project = create_project(client, admin_session, organization["id"])

    create_response = client.post(
        f"/api/v1/organizations/{organization['id']}/members",
        headers=auth_headers(admin_session),
        json={"user_id": str(member.id), "role": "engineer"},
    )
    forbidden = client.get(
        f"/api/v1/organizations/{organization['id']}/members",
        headers=auth_headers(outsider_session),
    )
    project_member = client.post(
        f"/api/v1/projects/{project['id']}/members",
        headers=auth_headers(admin_session),
        json={"user_id": str(member.id), "role": "viewer"},
    )

    assert create_response.status_code == 201
    assert forbidden.status_code == 403
    assert project_member.status_code == 201


def test_growth_metrics_rollup_only(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.growth_metrics.query_daily_metrics",
        lambda **kwargs: [],
    )
    monkeypatch.setattr(
        "app.services.growth_metrics._utc_now",
        lambda: datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        "app.services.growth_metrics.query_all_traces_via_router",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("raw warehouse routing should not be used")),
        raising=False,
    )

    metrics = get_growth_metrics(db_session)

    assert metrics["trace_volume"]["today"] == 0


def test_cost_metrics_rollup_only(client, db_session, monkeypatch):
    operator = create_operator(db_session, email="cost-rollup@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Cost Rollup Org", slug="cost-rollup-org")
    project = create_project(client, session_payload, organization["id"])

    monkeypatch.setattr(
        "app.services.cost_intelligence.query_hourly_metrics",
        lambda **kwargs: [],
    )
    monkeypatch.setattr(
        "app.services.cost_intelligence._utcnow",
        lambda: datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        "app.services.cost_intelligence.query_all_traces_via_router",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("raw warehouse routing should not be used")),
        raising=False,
    )

    metrics = get_project_cost_intelligence(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
    )

    assert metrics["cost_per_trace"] == 0.0
