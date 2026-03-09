import datetime
import os
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import get_settings
from app.db.session import get_db
from app.main import app
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.project import Project
from app.models.trace import Trace
from app.services.alerts import (
    ALERT_STATUS_PENDING,
    create_alert_deliveries_for_open_incidents,
    deliver_alert_delivery,
)
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.services.auth import create_operator_user
ROOT_DIR = Path(__file__).resolve().parents[3]


def _admin_database_url() -> str:
    return os.environ.get(
        "TEST_DATABASE_ADMIN_URL",
        "postgresql+psycopg://reliai:reliai@localhost:5432/postgres",
    )


def _database_url_for(name: str) -> str:
    admin_url = _admin_database_url()
    return f"{admin_url.rsplit('/', 1)[0]}/{name}"


@pytest.fixture(scope="module")
def postgres_database_url() -> Generator[str, None, None]:
    database_name = f"reliai_test_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(_admin_database_url(), future=True, isolation_level="AUTOCOMMIT")

    try:
        with admin_engine.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    except OperationalError as exc:
        pytest.skip(f"Postgres integration tests skipped: {exc}")

    database_url = _database_url_for(database_name)
    previous_database_url = os.environ.get("DATABASE_URL")
    get_settings.cache_clear()
    os.environ["DATABASE_URL"] = database_url

    alembic_config = Config("apps/api/alembic.ini")
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    alembic_config.set_main_option("script_location", str(ROOT_DIR / "infra/db/migrations"))
    command.upgrade(alembic_config, "head")

    try:
        yield database_url
    finally:
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        get_settings.cache_clear()
        with admin_engine.connect() as connection:
            connection.execute(
                text(
                    """
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = :database_name AND pid <> pg_backend_pid()
                    """
                ),
                {"database_name": database_name},
            )
            connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}"'))
        admin_engine.dispose()


@pytest.fixture
def postgres_session(postgres_database_url: str) -> Generator[Session, None, None]:
    engine = create_engine(postgres_database_url, future=True)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = session_local()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def postgres_client(postgres_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield postgres_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _sign_in(client: TestClient, *, email: str, password: str = "reliai-test-password") -> dict:
    response = client.post("/api/v1/auth/sign-in", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()


def _auth_headers(session_payload: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session_payload['session_token']}"}


def _create_organization(client: TestClient, session_payload: dict, *, name: str, slug: str) -> dict:
    response = client.post(
        "/api/v1/organizations",
        headers=_auth_headers(session_payload),
        json={
            "name": name,
            "slug": slug,
            "plan": "pilot",
            "owner_auth_user_id": session_payload["operator"]["id"],
            "owner_role": "owner",
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_project(client: TestClient, session_payload: dict, organization_id: str) -> dict:
    response = client.post(
        f"/api/v1/organizations/{organization_id}/projects",
        headers=_auth_headers(session_payload),
        json={"name": "Support Copilot", "environment": "prod"},
    )
    assert response.status_code == 201
    return response.json()


def _create_api_key(client: TestClient, session_payload: dict, project_id: str) -> dict:
    response = client.post(
        f"/api/v1/projects/{project_id}/api-keys",
        headers=_auth_headers(session_payload),
        json={"label": "Integration ingest"},
    )
    assert response.status_code == 201
    return response.json()


def _run_signal_pipeline(postgres_session: Session, trace_id: str) -> None:
    trace_uuid = uuid.UUID(trace_id)
    evaluation = run_structured_output_validity_evaluation(postgres_session, trace_uuid)
    assert evaluation is not None
    trace = postgres_session.get(Trace, trace_uuid)
    assert trace is not None
    project = postgres_session.get(Project, trace.project_id)
    assert project is not None
    for scope in build_scopes(trace):
        result = compute_regressions_for_scope(
            postgres_session, scope=scope, anchor_time=trace.timestamp
        )
        sync_incidents_for_scope(
            postgres_session,
            scope=scope,
            project=project,
            regressions=result.snapshots,
            detected_at=trace.timestamp,
        )
    postgres_session.commit()


def test_postgres_migrations_auth_and_trace_queries(
    postgres_client: TestClient,
    postgres_session: Session,
    fake_queue,
):
    owner_one = create_operator_user(
        postgres_session,
        email="owner-one@acme.test",
        password="reliai-test-password",
    )
    owner_two = create_operator_user(
        postgres_session,
        email="owner-two@beta.test",
        password="reliai-test-password",
    )
    postgres_session.commit()
    postgres_session.refresh(owner_one)
    postgres_session.refresh(owner_two)

    owner_one_session = _sign_in(postgres_client, email=owner_one.email)
    owner_two_session = _sign_in(postgres_client, email=owner_two.email)

    organization = _create_organization(
        postgres_client,
        owner_one_session,
        name="Acme AI",
        slug="acme-integration",
    )
    project = _create_project(postgres_client, owner_one_session, organization["id"])
    api_key = _create_api_key(postgres_client, owner_one_session, project["id"])

    for payload in [
        {
            "timestamp": "2026-03-09T10:00:00Z",
            "request_id": "req_pg_a",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
        },
        {
            "timestamp": "2026-03-09T11:00:00Z",
            "request_id": "req_pg_b",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v2",
            "success": False,
            "error_type": "provider_error",
        },
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_pg_c",
            "model_name": "claude-3-5-sonnet",
            "prompt_version": "v2",
            "success": True,
        },
    ]:
        ingest_response = postgres_client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key["api_key"]},
            json=payload,
        )
        assert ingest_response.status_code == 202
    assert len(fake_queue.jobs) == 3

    filtered = postgres_client.get(
        "/api/v1/traces",
        headers=_auth_headers(owner_one_session),
        params={
            "project_id": project["id"],
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v2",
            "success": "false",
        },
    )
    assert filtered.status_code == 200
    assert [item["request_id"] for item in filtered.json()["items"]] == ["req_pg_b"]

    first_page = postgres_client.get(
        "/api/v1/traces",
        headers=_auth_headers(owner_one_session),
        params={"project_id": project["id"], "limit": 2},
    )
    assert first_page.status_code == 200
    first_page_payload = first_page.json()
    assert len(first_page_payload["items"]) == 2
    assert first_page_payload["next_cursor"] is not None

    second_page = postgres_client.get(
        "/api/v1/traces",
        headers=_auth_headers(owner_one_session),
        params={"project_id": project["id"], "limit": 2, "cursor": first_page_payload["next_cursor"]},
    )
    assert second_page.status_code == 200
    assert [item["request_id"] for item in second_page.json()["items"]] == ["req_pg_a"]

    forbidden_list = postgres_client.get(
        "/api/v1/traces",
        headers=_auth_headers(owner_two_session),
        params={"project_id": project["id"]},
    )
    assert forbidden_list.status_code == 403

    trace_id = first_page_payload["items"][0]["id"]
    forbidden_detail = postgres_client.get(
        f"/api/v1/traces/{trace_id}",
        headers=_auth_headers(owner_two_session),
    )
    assert forbidden_detail.status_code == 404


def test_postgres_incident_workflow_core_path(
    postgres_client: TestClient,
    postgres_session: Session,
    fake_queue,
):
    owner = create_operator_user(
        postgres_session,
        email="incident-owner@acme.test",
        password="reliai-test-password",
    )
    postgres_session.commit()
    postgres_session.refresh(owner)

    session_payload = _sign_in(postgres_client, email=owner.email)
    organization = _create_organization(
        postgres_client,
        session_payload,
        name="Incident Org",
        slug="incident-org",
    )
    project = _create_project(postgres_client, session_payload, organization["id"])
    api_key = _create_api_key(postgres_client, session_payload, project["id"])

    baseline_start = datetime.datetime(2026, 3, 9, 9, 0, 30, tzinfo=datetime.timezone.utc)
    current_start = datetime.datetime(2026, 3, 9, 10, 0, 30, tzinfo=datetime.timezone.utc)

    for index in range(10):
        response = postgres_client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key["api_key"]},
            json={
                "timestamp": (baseline_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"pg_baseline_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v9",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 180,
                "total_cost_usd": "0.010000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        assert response.status_code == 202
        _run_signal_pipeline(postgres_session, response.json()["trace_id"])

    final_trace_id = None
    for index in range(10):
        response = postgres_client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key["api_key"]},
            json={
                "timestamp": (current_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"pg_current_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v9",
                "output_text": "{\"ok\":false}" if index == 0 else "not-json",
                "success": index == 0,
                "error_type": None if index == 0 else "provider_error",
                "latency_ms": 220 if index == 0 else 1100,
                "total_cost_usd": "0.014000" if index == 0 else "0.050000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        assert response.status_code == 202
        final_trace_id = response.json()["trace_id"]
        _run_signal_pipeline(postgres_session, final_trace_id)

    incidents_response = postgres_client.get(
        "/api/v1/incidents?status=open",
        headers=_auth_headers(session_payload),
    )
    assert incidents_response.status_code == 200
    incidents = incidents_response.json()["items"]
    assert any(item["incident_type"] == "success_rate_drop" for item in incidents)

    incident_id = incidents[0]["id"]
    detail_response = postgres_client.get(
        f"/api/v1/incidents/{incident_id}",
        headers=_auth_headers(session_payload),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["regressions"]
    assert detail_response.json()["traces"]
    assert detail_response.json()["events"]


def test_postgres_alert_workflow_core_path(
    postgres_client: TestClient,
    postgres_session: Session,
    fake_queue,
    monkeypatch,
):
    previous_webhook = os.environ.get("SLACK_WEBHOOK_DEFAULT")
    os.environ["SLACK_WEBHOOK_DEFAULT"] = "https://hooks.slack.test/services/default"
    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.services.alerts.httpx.post",
        lambda *args, **kwargs: type(
            "Resp",
            (),
            {
                "headers": {"x-slack-req-id": "pg-slack-1"},
                "raise_for_status": staticmethod(lambda: None),
            },
        )(),
    )

    try:
        owner = create_operator_user(
            postgres_session,
            email="alert-owner@acme.test",
            password="reliai-test-password",
        )
        postgres_session.commit()
        postgres_session.refresh(owner)

        session_payload = _sign_in(postgres_client, email=owner.email)
        organization = _create_organization(
            postgres_client,
            session_payload,
            name="Alert Org",
            slug="alert-org",
        )
        project = _create_project(postgres_client, session_payload, organization["id"])
        api_key = _create_api_key(postgres_client, session_payload, project["id"])

        baseline_start = datetime.datetime(2026, 3, 9, 9, 0, 30, tzinfo=datetime.timezone.utc)
        current_start = datetime.datetime(2026, 3, 9, 10, 0, 30, tzinfo=datetime.timezone.utc)

        for index in range(10):
            response = postgres_client.post(
                "/api/v1/ingest/traces",
                headers={"x-api-key": api_key["api_key"]},
                json={
                    "timestamp": (baseline_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                    "request_id": f"pg_alert_baseline_{index}",
                    "model_name": "gpt-4.1-mini",
                    "prompt_version": "v11",
                    "output_text": "{\"ok\":true}",
                    "success": True,
                    "latency_ms": 190,
                    "total_cost_usd": "0.010000",
                    "metadata_json": {"expected_output_format": "json"},
                },
            )
            assert response.status_code == 202
            _run_signal_pipeline(postgres_session, response.json()["trace_id"])

        for index in range(10):
            response = postgres_client.post(
                "/api/v1/ingest/traces",
                headers={"x-api-key": api_key["api_key"]},
                json={
                    "timestamp": (current_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                    "request_id": f"pg_alert_current_{index}",
                    "model_name": "gpt-4.1-mini",
                    "prompt_version": "v11",
                    "output_text": "{\"ok\":false}" if index == 0 else "not-json",
                    "success": index == 0,
                    "error_type": None if index == 0 else "provider_error",
                    "latency_ms": 240 if index == 0 else 1300,
                    "total_cost_usd": "0.014000" if index == 0 else "0.060000",
                    "metadata_json": {"expected_output_format": "json"},
                },
            )
            assert response.status_code == 202
            _run_signal_pipeline(postgres_session, response.json()["trace_id"])

        incidents_response = postgres_client.get(
            "/api/v1/incidents?status=open",
            headers=_auth_headers(session_payload),
        )
        assert incidents_response.status_code == 200
        incident_id = incidents_response.json()["items"][0]["id"]
        incident = postgres_session.get(Incident, uuid.UUID(incident_id))
        assert incident is not None

        deliveries = create_alert_deliveries_for_open_incidents(
            postgres_session,
            incidents=[incident],
        )
        postgres_session.commit()

        for delivery in deliveries:
            if delivery.delivery_status == ALERT_STATUS_PENDING:
                deliver_alert_delivery(postgres_session, delivery.id)

        alerts_response = postgres_client.get(
            f"/api/v1/incidents/{incident_id}/alerts",
            headers=_auth_headers(session_payload),
        )
        assert alerts_response.status_code == 200
        assert alerts_response.json()["items"]
        assert alerts_response.json()["items"][0]["delivery_status"] == "sent"

        resolve_response = postgres_client.post(
            f"/api/v1/incidents/{incident_id}/resolve",
            headers=_auth_headers(session_payload),
        )
        assert resolve_response.status_code == 200
        assert resolve_response.json()["status"] == "resolved"

        reopen_response = postgres_client.post(
            f"/api/v1/incidents/{incident_id}/reopen",
            headers=_auth_headers(session_payload),
        )
        assert reopen_response.status_code == 200
        assert reopen_response.json()["status"] == "open"

        events_response = postgres_client.get(
            f"/api/v1/incidents/{incident_id}/events",
            headers=_auth_headers(session_payload),
        )
        assert events_response.status_code == 200
        event_types = [item["event_type"] for item in events_response.json()["items"]]
        assert "resolved" in event_types
        assert "reopened" in event_types

        persisted_events = postgres_session.query(IncidentEvent).filter(
            IncidentEvent.incident_id == uuid.UUID(incident_id)
        ).all()
        assert persisted_events
    finally:
        if previous_webhook is None:
            os.environ.pop("SLACK_WEBHOOK_DEFAULT", None)
        else:
            os.environ["SLACK_WEBHOOK_DEFAULT"] = previous_webhook
        get_settings.cache_clear()


def test_postgres_settings_and_filtered_incident_path(
    postgres_client: TestClient,
    postgres_session: Session,
    fake_queue,
):
    owner = create_operator_user(
        postgres_session,
        email="settings-filter-owner@acme.test",
        password="reliai-test-password",
    )
    postgres_session.commit()
    postgres_session.refresh(owner)

    session_payload = _sign_in(postgres_client, email=owner.email)
    organization = _create_organization(
        postgres_client,
        session_payload,
        name="Settings Filter Org",
        slug="settings-filter-org",
    )

    target_response = postgres_client.put(
        f"/api/v1/organizations/{organization['id']}/alert-target",
        headers=_auth_headers(session_payload),
        json={
            "channel_target": "org:postgres-slack",
            "slack_webhook_url": "https://hooks.slack.test/services/postgres",
            "is_active": True,
        },
    )
    assert target_response.status_code == 200
    assert target_response.json()["has_secret"] is True
    assert "slack_webhook_url" not in target_response.json()

    project = _create_project(postgres_client, session_payload, organization["id"])
    api_key = _create_api_key(postgres_client, session_payload, project["id"])

    baseline_start = datetime.datetime(2026, 3, 9, 9, 0, 30, tzinfo=datetime.timezone.utc)
    current_start = datetime.datetime(2026, 3, 9, 10, 0, 30, tzinfo=datetime.timezone.utc)

    for index in range(10):
        response = postgres_client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key["api_key"]},
            json={
                "timestamp": (baseline_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"pg_settings_baseline_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v13",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 180,
                "total_cost_usd": "0.010000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        assert response.status_code == 202
        _run_signal_pipeline(postgres_session, response.json()["trace_id"])

    for index in range(10):
        response = postgres_client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key["api_key"]},
            json={
                "timestamp": (current_start + datetime.timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"pg_settings_current_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v13",
                "output_text": "{\"ok\":false}" if index == 0 else "not-json",
                "success": index == 0,
                "error_type": None if index == 0 else "provider_error",
                "latency_ms": 200 if index == 0 else 1200,
                "total_cost_usd": "0.014000" if index == 0 else "0.050000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        assert response.status_code == 202
        _run_signal_pipeline(postgres_session, response.json()["trace_id"])

    incidents_response = postgres_client.get(
        f"/api/v1/incidents?project_id={project['id']}&severity=critical&date_from=2026-03-09&date_to=2026-03-09",
        headers=_auth_headers(session_payload),
    )
    assert incidents_response.status_code == 200
    incidents = incidents_response.json()["items"]
    assert incidents
    assert all(item["project_id"] == project["id"] for item in incidents)
    assert all(item["severity"] == "critical" for item in incidents)

    incident_id = incidents[0]["id"]
    incident_detail = postgres_client.get(
        f"/api/v1/incidents/{incident_id}",
        headers=_auth_headers(session_payload),
    )
    assert incident_detail.status_code == 200
    assert incident_detail.json()["compare"]["regressions"]
    assert incident_detail.json()["compare"]["representative_traces"]

    regression_id = incident_detail.json()["compare"]["regressions"][0]["id"]
    regression_detail = postgres_client.get(
        f"/api/v1/regressions/{regression_id}",
        headers=_auth_headers(session_payload),
    )
    assert regression_detail.status_code == 200
    assert regression_detail.json()["related_incident"] is not None
