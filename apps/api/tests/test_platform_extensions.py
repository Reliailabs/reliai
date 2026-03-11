from datetime import datetime, timezone

import pytest

from app.processors.dispatcher import dispatch_event_sync
from app.services.event_stream import EventMessage

from .test_api import (
    auth_headers,
    create_operator,
    create_organization,
    create_project,
    sign_in,
)


def test_platform_extension_install_and_list_returns_runtime_fields(client, db_session):
    owner = create_operator(db_session, email="extensions-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Extensions Org", slug="extensions-org")
    project = create_project(client, session_payload, organization["id"])

    created = client.post(
        f"/api/v1/organizations/{organization['id']}/extensions",
        headers=auth_headers(session_payload),
        json={
            "organization_id": organization["id"],
            "project_id": project["id"],
            "name": "Latency gate extension",
            "event_type": "deployment_created",
            "endpoint_url": "https://extension.acme.test/deploy",
            "secret": "extension-secret-value",
            "processor_type": "extension",
            "version": "1.2.0",
            "enabled": True,
            "config_json": {
                "allowed_events": ["deployment_created"],
                "runtime_limits": {"timeout_seconds": 8, "max_retries": 2},
            },
        },
    )
    assert created.status_code == 201

    listed = client.get(
        f"/api/v1/organizations/{organization['id']}/extensions",
        headers=auth_headers(session_payload),
    )
    assert listed.status_code == 200
    item = listed.json()["items"][0]
    assert item["processor_type"] == "extension"
    assert item["version"] == "1.2.0"
    assert item["health"] in {"healthy", "degraded", "disabled"}
    assert item["config_json"]["runtime_limits"]["timeout_seconds"] == 8
    assert item["event_type"] == "deployment_created"


def test_platform_extension_dispatch_isolated_and_records_runtime(client, db_session, monkeypatch: pytest.MonkeyPatch):
    owner = create_operator(db_session, email="extensions-dispatch@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Dispatch Org", slug="dispatch-org")
    project = create_project(client, session_payload, organization["id"])

    create_response = client.post(
        f"/api/v1/organizations/{organization['id']}/extensions",
        headers=auth_headers(session_payload),
        json={
            "organization_id": organization["id"],
            "project_id": project["id"],
            "name": "Incident webhook extension",
            "event_type": "incident_created",
            "endpoint_url": "https://extension.acme.test/incidents",
            "secret": "extension-secret-value",
            "processor_type": "extension",
            "version": "1.0.0",
            "enabled": True,
            "config_json": {
                "allowed_events": ["incident_created"],
                "runtime_limits": {"timeout_seconds": 6, "max_retries": 1},
            },
        },
    )
    assert create_response.status_code == 201

    attempts = []

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

    def fake_post(url, json, headers, timeout):
        attempts.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return FakeResponse()

    monkeypatch.setattr("app.services.external_processors.httpx.post", fake_post)

    report = dispatch_event_sync(
        EventMessage(
            topic="trace_events",
            key=project["id"],
            partition=0,
            offset=0,
            event_type="incident_created",
            payload={
                "project_id": project["id"],
                "incident_id": "incident-ext-1",
                "event_type": "incident_created",
                "timestamp": "2026-03-11T18:00:00Z",
            },
            published_at=datetime.now(timezone.utc),
        ),
        processors=[],
    )

    assert attempts
    assert attempts[0]["timeout"] == 6.0
    assert report.processor_results[0].processor_name == "extension:Incident webhook extension"
    assert report.processor_results[0].success is True

    listed = client.get(
        f"/api/v1/organizations/{organization['id']}/extensions",
        headers=auth_headers(session_payload),
    )
    item = listed.json()["items"][0]
    assert item["event_throughput_per_hour"] >= 1
    assert item["last_invoked_at"] is not None


def test_system_extensions_endpoint_is_admin_only(client, db_session):
    owner = create_operator(db_session, email="extensions-user@acme.test")
    owner_session = sign_in(client, email=owner.email)
    admin = create_operator(db_session, email="extensions-admin@acme.test", is_system_admin=True)
    admin_session = sign_in(client, email=admin.email)

    forbidden = client.get("/api/v1/system/extensions", headers=auth_headers(owner_session))
    allowed = client.get("/api/v1/system/extensions", headers=auth_headers(admin_session))

    assert forbidden.status_code == 403
    assert allowed.status_code == 200
    assert "items" in allowed.json()
