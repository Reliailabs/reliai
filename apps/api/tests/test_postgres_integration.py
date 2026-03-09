import os
import uuid
from collections.abc import Generator

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
from app.services.auth import create_operator_user


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

    alembic_config = Config("alembic.ini")
    alembic_config.set_main_option("sqlalchemy.url", database_url)
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
