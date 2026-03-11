from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from app.services.trace_warehouse import TraceWarehouseEventRow
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
    monkeypatch,
):
    now = datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_expansion_metrics._utc_now", lambda: now)

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

    response = client.get("/api/v1/system/customer-expansion", headers=auth_headers(session_payload))

    assert response.status_code == 200
    payload = response.json()
    assert payload["breakout_customers"] == 1
    assert len(payload["organizations"]) == 2
    assert payload["organizations"][0]["organization_id"] == acme["id"]
    assert payload["organizations"][0]["first_30_day_volume"] == 10
    assert payload["organizations"][0]["current_30_day_volume"] == 120
    assert payload["organizations"][0]["expansion_ratio"] == 12.0
    assert payload["organizations"][0]["breakout"] is True
    assert payload["organizations"][1]["organization_id"] == beta["id"]
    assert payload["organizations"][1]["expansion_ratio"] == 2.0
    assert payload["average_expansion_ratio"] == 7.0
    assert payload["total_platform_growth_pct"] == 433.3


def test_system_customer_expansion_requires_operator_auth(client):
    response = client.get("/api/v1/system/customer-expansion")
    assert response.status_code == 401
