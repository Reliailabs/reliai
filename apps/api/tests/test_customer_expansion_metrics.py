from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from app.models.organization_usage_expansion import OrganizationUsageExpansion
from app.services.trace_warehouse import TraceWarehouseEventRow
from app.workers.usage_expansion_metrics import run_usage_expansion_metrics
from .conftest import BorrowedSession
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _seed_expansion_operator(client, db_session, *, suffix: str):
    operator = create_operator(
        db_session,
        email=f"expansion-{suffix}@acme.test",
        is_system_admin=True,
    )
    return sign_in(client, email=operator.email)


def _add_trace_rows(fake_trace_warehouse, project: dict, *, count: int, day: datetime) -> None:
    rows = []
    for index in range(count):
        rows.append(
            TraceWarehouseEventRow(
                timestamp=day + timedelta(minutes=index),
                organization_id=UUID(project["organization_id"]),
                project_id=UUID(project["id"]),
                environment_id=UUID(project["environments"][0]["id"]),
                storage_trace_id=uuid4(),
                trace_id=str(uuid4()),
                success=True,
                model_provider="openai",
                model_family="gpt-4.1",
                model_revision="2026-03",
                prompt_version_id="v1",
                input_tokens=20,
                output_tokens=10,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                retrieval_latency_ms=25,
                retrieval_chunks=4,
                metadata_json={"__model_name": "gpt-4.1", "__prompt_version": "v1"},
            )
        )
    fake_trace_warehouse.insert_trace_events(rows)


def test_system_customer_expansion_endpoint_reports_ranked_org_growth(
    client,
    db_session,
    fake_trace_warehouse,
    fake_event_stream,
    monkeypatch,
):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_expansion_metrics._utc_now", lambda: now)
    monkeypatch.setattr("app.workers.usage_expansion_metrics.SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr("app.services.customer_expansion_metrics.BREAKOUT_MIN_TRACES", 100)
    monkeypatch.setattr("app.services.customer_expansion_metrics.EXPANSION_MIN_BASELINE_TRACES", 1)

    session_payload = _seed_expansion_operator(client, db_session, suffix="ranked")
    acme = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    beta = create_organization(client, session_payload, name="Beta Labs", slug="beta-labs")
    project_acme = create_project(client, session_payload, acme["id"], name="Acme Copilot")
    project_beta = create_project(client, session_payload, beta["id"], name="Beta Search")

    first_window_start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    current_window_start = datetime(2026, 2, 10, 12, 0, tzinfo=timezone.utc)
    for offset in range(10):
        _add_trace_rows(fake_trace_warehouse, project_acme, count=1, day=first_window_start + timedelta(days=offset))
    for offset in range(20):
        _add_trace_rows(fake_trace_warehouse, project_acme, count=6, day=current_window_start + timedelta(days=offset))

    for offset in range(10):
        _add_trace_rows(fake_trace_warehouse, project_beta, count=2, day=first_window_start + timedelta(days=offset))
    for offset in range(20):
        _add_trace_rows(fake_trace_warehouse, project_beta, count=2, day=current_window_start + timedelta(days=offset))

    run_usage_expansion_metrics()

    response = client.get("/api/v1/system/customer-expansion", headers=auth_headers(session_payload))

    assert response.status_code == 200
    payload = response.json()
    assert payload["breakout_customers"] == 1
    assert payload["median_expansion_ratio"] > 1.0
    assert payload["top_expansion_ratio"] >= 10.0
    assert payload["total_telemetry_30d"] >= 100
    assert len(payload["organizations"]) == 2
    assert payload["organizations"][0]["organization_id"] == acme["id"]
    assert payload["organizations"][0]["first_30_day_volume"] == 10
    assert payload["organizations"][0]["current_30_day_volume"] >= 100
    assert payload["organizations"][0]["expansion_ratio"] >= 10.0
    assert payload["organizations"][0]["breakout"] is True
    assert payload["organizations"][1]["organization_id"] == beta["id"]
    assert payload["organizations"][1]["expansion_ratio"] < payload["organizations"][0]["expansion_ratio"]
    assert payload["average_expansion_ratio"] >= payload["organizations"][1]["expansion_ratio"]
    assert payload["total_platform_growth_pct"] > 0


def test_usage_expansion_worker_persists_rows_and_emits_breakout_once(
    client,
    db_session,
    fake_trace_warehouse,
    fake_event_stream,
    monkeypatch,
):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_expansion_metrics._utc_now", lambda: now)
    monkeypatch.setattr("app.workers.usage_expansion_metrics.SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr("app.services.customer_expansion_metrics.BREAKOUT_MIN_TRACES", 100)
    monkeypatch.setattr("app.services.customer_expansion_metrics.EXPANSION_MIN_BASELINE_TRACES", 1)

    session_payload = _seed_expansion_operator(client, db_session, suffix="worker")
    acme = create_organization(client, session_payload, name="Worker Acme", slug="worker-acme")
    project = create_project(client, session_payload, acme["id"], name="Worker Project")

    first_window_start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    current_window_start = datetime(2026, 2, 10, 12, 0, tzinfo=timezone.utc)
    for offset in range(10):
        _add_trace_rows(fake_trace_warehouse, project, count=1, day=first_window_start + timedelta(days=offset))
    for offset in range(20):
        _add_trace_rows(fake_trace_warehouse, project, count=6, day=current_window_start + timedelta(days=offset))

    first_run = run_usage_expansion_metrics()
    second_run = run_usage_expansion_metrics()

    stored = db_session.get(OrganizationUsageExpansion, UUID(acme["id"]))
    messages = list(fake_event_stream.consume("trace_events"))

    assert first_run["organizations_recomputed"] == 1
    assert first_run["breakout_events_emitted"] == 1
    assert second_run["breakout_events_emitted"] == 0
    assert stored is not None
    assert stored.first_30_day_traces == 10
    assert stored.current_30_day_traces >= 100
    assert stored.expansion_ratio >= 10.0
    assert stored.breakout_account is True
    assert [message.payload["event_type"] for message in messages] == ["breakout_account_detected"]
    assert messages[0].payload["organization_id"] == acme["id"]


def test_system_customer_expansion_requires_operator_auth(client):
    response = client.get("/api/v1/system/customer-expansion")
    assert response.status_code == 401


def test_usage_expansion_ignores_low_baseline_false_breakouts(
    client,
    db_session,
    fake_trace_warehouse,
    fake_event_stream,
    monkeypatch,
):
    now = datetime(2026, 3, 31, 15, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_expansion_metrics._utc_now", lambda: now)
    monkeypatch.setattr("app.workers.usage_expansion_metrics.SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr("app.services.customer_expansion_metrics.BREAKOUT_MIN_TRACES", 100)

    session_payload = _seed_expansion_operator(client, db_session, suffix="baseline-guard")
    organization = create_organization(client, session_payload, name="Tiny Baseline Org", slug="tiny-baseline-org")
    project = create_project(client, session_payload, organization["id"], name="Tiny Baseline Project")

    first_window_start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    current_window_start = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)
    _add_trace_rows(fake_trace_warehouse, project, count=10, day=first_window_start)
    _add_trace_rows(fake_trace_warehouse, project, count=1000, day=current_window_start)

    run_usage_expansion_metrics()

    stored = db_session.get(OrganizationUsageExpansion, UUID(organization["id"]))
    messages = list(fake_event_stream.consume("trace_events"))

    assert stored is not None
    assert stored.first_30_day_traces == 10
    assert stored.current_30_day_traces == 1000
    assert stored.expansion_ratio == 0.0
    assert stored.breakout_account is False
    assert messages == []


def test_customer_expansion_ranks_fastest_growing_orgs_first(
    client,
    db_session,
    fake_trace_warehouse,
    fake_event_stream,
    monkeypatch,
):
    now = datetime(2026, 3, 31, 15, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_expansion_metrics._utc_now", lambda: now)
    monkeypatch.setattr("app.workers.usage_expansion_metrics.SessionLocal", lambda: BorrowedSession(db_session))
    monkeypatch.setattr("app.services.customer_expansion_metrics.BREAKOUT_MIN_TRACES", 10_000)
    monkeypatch.setattr("app.services.customer_expansion_metrics.EXPANSION_MIN_BASELINE_TRACES", 500)

    session_payload = _seed_expansion_operator(client, db_session, suffix="rank-order")
    org_a = create_organization(client, session_payload, name="Org A", slug="org-a")
    org_b = create_organization(client, session_payload, name="Org B", slug="org-b")
    org_c = create_organization(client, session_payload, name="Org C", slug="org-c")
    project_a = create_project(client, session_payload, org_a["id"], name="Org A Project")
    project_b = create_project(client, session_payload, org_b["id"], name="Org B Project")
    project_c = create_project(client, session_payload, org_c["id"], name="Org C Project")

    first_window_start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    current_window_start = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)
    for offset in range(10):
        _add_trace_rows(fake_trace_warehouse, project_a, count=100, day=first_window_start + timedelta(days=offset))
        _add_trace_rows(fake_trace_warehouse, project_b, count=200, day=first_window_start + timedelta(days=offset))
        _add_trace_rows(fake_trace_warehouse, project_c, count=50, day=first_window_start + timedelta(days=offset))
    for offset in range(10):
        _add_trace_rows(fake_trace_warehouse, project_a, count=1000, day=current_window_start + timedelta(days=offset))
        _add_trace_rows(fake_trace_warehouse, project_b, count=400, day=current_window_start + timedelta(days=offset))
        _add_trace_rows(fake_trace_warehouse, project_c, count=2000, day=current_window_start + timedelta(days=offset))

    run_usage_expansion_metrics()

    response = client.get("/api/v1/system/customer-expansion", headers=auth_headers(session_payload))
    payload = response.json()
    messages = list(fake_event_stream.consume("trace_events"))

    assert response.status_code == 200
    assert [item["organization_name"] for item in payload["organizations"][:3]] == ["Org C", "Org A", "Org B"]
    assert payload["organizations"][0]["expansion_ratio"] == 40.0
    assert payload["organizations"][1]["expansion_ratio"] == 10.0
    assert payload["organizations"][2]["expansion_ratio"] == 2.0
    assert any(message.payload["event_type"] == "breakout_account_detected" for message in messages)
    breakout_org_ids = {message.payload["organization_id"] for message in messages}
    assert org_c["id"] in breakout_org_ids
