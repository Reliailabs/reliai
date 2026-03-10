from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.environment import Environment
from app.models.incident import Incident
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_project_bootstraps_production_environment_and_can_create_staging(client, db_session):
    operator = create_operator(db_session, email="environments-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name="Environment Org",
        slug="environment-org",
    )
    project = create_project(client, session_payload, organization["id"], name="Environment Service")

    initial = client.get(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(session_payload),
    )
    assert initial.status_code == 200
    assert initial.json()["items"] == [
        {
            "id": initial.json()["items"][0]["id"],
            "project_id": project["id"],
            "name": "production",
            "type": "production",
            "created_at": initial.json()["items"][0]["created_at"],
        }
    ]

    created = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(session_payload),
        json={"name": "staging", "type": "staging"},
    )
    assert created.status_code == 201
    assert created.json()["name"] == "staging"
    assert created.json()["type"] == "staging"


def test_trace_ingest_and_project_trace_alias_filter_by_environment(client, db_session):
    operator = create_operator(db_session, email="trace-env-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Trace Env Org", slug="trace-env-org")
    project = create_project(client, session_payload, organization["id"], name="Trace Env Service")
    api_key = create_api_key(client, session_payload, project["id"])

    create_env = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(session_payload),
        json={"name": "staging", "type": "staging"},
    )
    assert create_env.status_code == 201

    production_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T12:00:00Z",
            "request_id": "prod-trace",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "prompt_tokens": 10,
            "completion_tokens": 4,
        },
    )
    staging_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T12:05:00Z",
            "request_id": "staging-trace",
            "environment": "staging",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "prompt_tokens": 11,
            "completion_tokens": 5,
        },
    )

    production = client.get(
        f"/api/v1/projects/{project['id']}/traces?environment=production",
        headers=auth_headers(session_payload),
    )
    staging = client.get(
        f"/api/v1/projects/{project['id']}/traces?environment=staging",
        headers=auth_headers(session_payload),
    )

    assert production.status_code == 200
    assert staging.status_code == 200
    assert [item["id"] for item in production.json()["items"]] == [production_trace["trace_id"]]
    assert [item["id"] for item in staging.json()["items"]] == [staging_trace["trace_id"]]


def test_project_incidents_alias_filters_environment_scope(client, db_session):
    operator = create_operator(db_session, email="incident-env-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Incident Env Org", slug="incident-env-org")
    project = create_project(client, session_payload, organization["id"], name="Incident Env Service")

    production_env = db_session.scalar(
        select(Environment).where(
            Environment.project_id == UUID(project["id"]),
            Environment.name == "production",
        )
    )
    assert production_env is not None

    staging_response = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(session_payload),
        json={"name": "staging", "type": "staging"},
    )
    assert staging_response.status_code == 201
    staging_env = db_session.get(Environment, UUID(staging_response.json()["id"]))
    assert staging_env is not None

    db_session.add_all(
        [
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=production_env.id,
                incident_type="success_rate_drop",
                severity="high",
                title="Production incident",
                status="open",
                fingerprint=f"prod:{uuid4()}",
                summary_json={"metric_name": "success_rate"},
                started_at=datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc),
                updated_at=datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc),
            ),
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=staging_env.id,
                incident_type="success_rate_drop",
                severity="medium",
                title="Staging incident",
                status="open",
                fingerprint=f"staging:{uuid4()}",
                summary_json={"metric_name": "success_rate"},
                started_at=datetime(2026, 3, 10, 12, 5, tzinfo=timezone.utc),
                updated_at=datetime(2026, 3, 10, 12, 5, tzinfo=timezone.utc),
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/incidents?environment=staging",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()
    assert [item["title"] for item in payload["items"]] == ["Staging incident"]
