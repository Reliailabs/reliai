from datetime import datetime, timezone

import pytest

from app.models.processor_failure import ProcessorFailure
from app.processors.dispatcher import dispatch_event_sync
from app.services.event_stream import EventMessage
from .test_api import (
    auth_headers,
    create_operator,
    create_organization,
    create_project,
    sign_in,
)


def test_project_processor_endpoints_are_tenant_safe(client, db_session):
    owner_one = create_operator(db_session, email="processor-one@acme.test")
    owner_two = create_operator(db_session, email="processor-two@beta.test")
    session_one = sign_in(client, email=owner_one.email)
    session_two = sign_in(client, email=owner_two.email)

    organization = create_organization(client, session_one, name="Acme AI", slug="acme-processor-org")
    project = create_project(client, session_one, organization["id"])

    create_response = client.post(
        f"/api/v1/projects/{project['id']}/processors",
        headers=auth_headers(session_one),
        json={
            "name": "Webhook sink",
            "event_type": "trace_ingested",
            "endpoint_url": "https://processor.acme.test/trace",
            "secret": "top-secret-processor",
            "enabled": True,
        },
    )
    assert create_response.status_code == 201
    processor = create_response.json()

    forbidden_list = client.get(
        f"/api/v1/projects/{project['id']}/processors",
        headers=auth_headers(session_two),
    )
    forbidden_patch = client.patch(
        f"/api/v1/projects/{project['id']}/processors/{processor['id']}",
        headers=auth_headers(session_two),
        json={"enabled": False},
    )

    assert forbidden_list.status_code == 403
    assert forbidden_patch.status_code == 403


def test_external_processor_dispatch_signs_retries_and_records_dlq(client, db_session, monkeypatch: pytest.MonkeyPatch):
    owner = create_operator(db_session, email="processor-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Processor Org", slug="processor-org")
    project = create_project(client, session_payload, organization["id"])

    create_response = client.post(
        f"/api/v1/projects/{project['id']}/processors",
        headers=auth_headers(session_payload),
        json={
            "name": "Failing processor",
            "event_type": "trace_ingested",
            "endpoint_url": "https://processor.acme.test/fail",
            "secret": "shared-secret-value",
            "enabled": True,
        },
    )
    assert create_response.status_code == 201

    attempts = []

    class FakeResponse:
        status_code = 500

        def raise_for_status(self):
            raise RuntimeError("processor down")

    def fake_post(url, json, headers, timeout):
        attempts.append(
            {
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return FakeResponse()

    monkeypatch.setattr("app.services.external_processors.httpx.post", fake_post)

    report = dispatch_event_sync(
        EventMessage(
            topic="trace_events",
            key=project["id"],
            partition=0,
            offset=0,
            event_type="trace_ingested",
            payload={
                "project_id": project["id"],
                "trace_id": "trace-ext-1",
                "event_type": "trace_ingested",
                "timestamp": "2026-03-10T22:00:00Z",
            },
            published_at=datetime.now(timezone.utc),
        ),
        processors=[],
    )

    assert len(attempts) == 4
    first = attempts[0]
    assert first["headers"]["X-Reliai-Event-Type"] == "trace_ingested"
    assert len(first["headers"]["X-Reliai-Signature"]) == 64
    assert first["json"]["project_id"] == project["id"]
    assert first["json"]["payload"]["trace_id"] == "trace-ext-1"
    assert report.processor_results[0].processor_name == "external:Failing processor"
    assert report.processor_results[0].success is False
    assert report.processor_results[0].attempts == 4

    failures = db_session.query(ProcessorFailure).all()
    assert len(failures) == 1
    assert failures[0].project_id.hex == project["id"].replace("-", "")
    assert failures[0].attempts == 4
    assert failures[0].event_type == "trace_ingested"
    assert failures[0].payload_json["payload"]["trace_id"] == "trace-ext-1"
