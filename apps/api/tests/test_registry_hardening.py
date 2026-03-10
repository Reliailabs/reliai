from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.model_version import ModelVersion
from app.models.project import Project
from app.models.trace import Trace
from app.workers.registry_backfill import run_registry_backfill_batches
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_registry_project(client, db_session):
    operator = create_operator(db_session, email="registry-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Registry Org", slug="registry-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def test_ingest_populates_canonical_model_identity(client, db_session, fake_queue):
    _, project, api_key = _seed_registry_project(client, db_session)

    payload = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "registry_trace",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "success": True,
            "latency_ms": 180,
            "prompt_tokens": 50,
            "completion_tokens": 20,
            "metadata_json": {"model_version": "2026-03", "model_route": "prod-default"},
        },
    )

    trace = db_session.get(Trace, UUID(payload["trace_id"]))
    assert trace is not None
    model_record = db_session.get(ModelVersion, trace.model_version_record_id)
    assert model_record is not None
    assert model_record.project_id == UUID(project["id"])
    assert model_record.model_family == "gpt-4-mini"
    assert model_record.model_revision == "4.1"


def test_registry_backfill_links_existing_traces_without_creating_duplicates(client, db_session, fake_queue):
    _, project, api_key = _seed_registry_project(client, db_session)

    first = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "registry_first",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v5",
            "success": True,
            "latency_ms": 150,
            "prompt_tokens": 30,
            "completion_tokens": 15,
            "metadata_json": {"model_version": "2026-03", "model_route": "primary"},
        },
    )
    first_trace = db_session.get(Trace, UUID(first["trace_id"]))
    assert first_trace is not None
    prompt_record_id = first_trace.prompt_version_record_id
    model_record_id = first_trace.model_version_record_id
    assert prompt_record_id is not None
    assert model_record_id is not None

    second = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T13:00:00Z",
            "request_id": "registry_second",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v5",
            "success": True,
            "latency_ms": 155,
            "prompt_tokens": 32,
            "completion_tokens": 16,
            "metadata_json": {"model_version": "2026-03", "model_route": "primary"},
        },
    )
    second_trace = db_session.get(Trace, UUID(second["trace_id"]))
    assert second_trace is not None
    second_trace.prompt_version_record_id = None
    second_trace.model_version_record_id = None
    db_session.add(second_trace)
    project_row = db_session.get(Project, UUID(project["id"]))
    assert project_row is not None
    project_row.last_trace_received_at = None
    db_session.add(project_row)
    db_session.commit()

    result = run_registry_backfill_batches(db_session, batch_size=1000)

    refreshed_trace = db_session.get(Trace, second_trace.id)
    refreshed_project = db_session.get(Project, UUID(project["id"]))
    assert refreshed_trace is not None
    assert refreshed_trace.prompt_version_record_id == prompt_record_id
    assert refreshed_trace.model_version_record_id == model_record_id
    assert refreshed_project is not None
    assert refreshed_project.last_trace_received_at is not None
    assert result["matched"] >= 1
    assert result["remaining"] == 0


def test_prompt_and_model_detail_endpoints_are_tenant_safe(client, db_session, fake_queue):
    session_payload, project, api_key = _seed_registry_project(client, db_session)
    payload = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "detail_trace",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v7",
            "success": True,
            "latency_ms": 210,
            "prompt_tokens": 42,
            "completion_tokens": 18,
            "metadata_json": {"model_version": "2026-03", "model_route": "primary"},
        },
    )
    trace = db_session.get(Trace, UUID(payload["trace_id"]))
    assert trace is not None

    prompt_response = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions/{trace.prompt_version_record_id}",
        headers=auth_headers(session_payload),
    )
    model_response = client.get(
        f"/api/v1/projects/{project['id']}/model-versions/{trace.model_version_record_id}",
        headers=auth_headers(session_payload),
    )
    assert prompt_response.status_code == 200
    assert prompt_response.json()["prompt_version"]["version"] == "v7"
    assert prompt_response.json()["usage_summary"]["trace_count"] >= 1
    assert model_response.status_code == 200
    assert model_response.json()["model_version"]["model_family"] == "gpt-4"

    outsider = create_operator(db_session, email="registry-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions/{trace.prompt_version_record_id}",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403


def test_trace_compare_uses_deterministic_seven_day_fallback(client, db_session, fake_queue):
    session_payload, project, api_key = _seed_registry_project(client, db_session)
    base_time = datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc)

    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": (base_time - timedelta(days=3)).isoformat(),
            "request_id": "baseline_peer",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v9",
            "success": True,
            "latency_ms": 400,
            "prompt_tokens": 120,
            "completion_tokens": 40,
            "metadata_json": {"model_version": "2026-03", "model_route": "primary"},
        },
    )
    current_payload = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": base_time.isoformat(),
            "request_id": "current_peer",
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "prompt_version": "v9",
            "success": False,
            "error_type": "provider_error",
            "latency_ms": 410,
            "prompt_tokens": 118,
            "completion_tokens": 41,
            "metadata_json": {"model_version": "2026-03", "model_route": "primary"},
        },
    )
    current_trace_id = UUID(current_payload["trace_id"])

    compare_response = client.get(
        f"/api/v1/traces/{current_trace_id}/compare",
        headers=auth_headers(session_payload),
    )
    assert compare_response.status_code == 200
    assert compare_response.json()["pairs"][0]["baseline_trace"]["request_id"] == "baseline_peer"
