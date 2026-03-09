from uuid import UUID

from app.models.api_key import APIKey
from app.models.evaluation import Evaluation
from app.models.onboarding_checklist import OnboardingChecklist
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.workers.evaluations import run_trace_evaluations


def create_organization(client):
    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "Acme AI",
            "slug": "acme-ai",
            "plan": "pilot",
            "owner_auth_user_id": "user_123",
            "owner_role": "owner",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_project(client, organization_id):
    response = client.post(
        f"/api/v1/organizations/{organization_id}/projects",
        json={
            "name": "Support Copilot",
            "environment": "prod",
            "description": "Primary production app",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_api_key(client, project_id):
    response = client.post(
        f"/api/v1/projects/{project_id}/api-keys",
        json={"label": "Production ingest"},
    )
    assert response.status_code == 201
    return response.json()


def test_health_endpoints(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_organization_and_project_endpoints(client):
    organization = create_organization(client)
    organization_fetch = client.get(f"/api/v1/organizations/{organization['id']}")
    assert organization_fetch.status_code == 200
    assert organization_fetch.json()["slug"] == "acme-ai"

    project = create_project(client, organization["id"])
    project_fetch = client.get(f"/api/v1/projects/{project['id']}")
    assert project_fetch.status_code == 200
    assert project_fetch.json()["environment"] == "prod"


def test_duplicate_organization_slug_returns_conflict(client):
    create_organization(client)

    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "Acme AI Duplicate",
            "slug": "acme-ai",
            "plan": "pilot",
            "owner_auth_user_id": "user_456",
            "owner_role": "owner",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Organization slug already exists"


def test_create_api_key_hashes_secret(client, db_session):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    key_record = db_session.get(APIKey, UUID(api_key_response["api_key_record"]["id"]))
    assert key_record is not None
    assert api_key_response["api_key"].startswith("reliai_")
    assert key_record.key_hash != api_key_response["api_key"]


def test_ingest_trace_happy_path(client, db_session, fake_queue, monkeypatch):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_123",
            "user_id": "user_42",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "input_text": "Hello",
            "output_text": "Hi",
            "latency_ms": 320,
            "prompt_tokens": 40,
            "completion_tokens": 12,
            "total_cost_usd": "0.012000",
            "success": True,
            "metadata_json": {"route": "support", "expected_output_format": "json"},
            "retrieval": {
                "retrieval_latency_ms": 42,
                "source_count": 3,
                "top_k": 5,
                "query_text": "refund eligibility",
                "retrieved_chunks_json": [{"document_id": "doc_1"}],
            },
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "accepted"

    stored_trace = db_session.get(Trace, UUID(payload["trace_id"]))
    assert stored_trace is not None
    assert stored_trace.request_id == "req_123"
    assert stored_trace.model_name == "gpt-4.1-mini"
    assert stored_trace.organization_id == UUID(organization["id"])
    assert stored_trace.environment == "prod"
    assert stored_trace.output_preview == "Hi"

    retrieval_span = (
        db_session.query(RetrievalSpan)
        .filter(RetrievalSpan.trace_id == stored_trace.id)
        .one()
    )
    assert retrieval_span.source_count == 3
    assert len(fake_queue.jobs) == 1
    assert fake_queue.jobs[0][1] == (str(stored_trace.id),)

    checklist = (
        db_session.query(OnboardingChecklist)
        .filter(OnboardingChecklist.organization_id == UUID(organization["id"]))
        .one()
    )
    assert checklist.project_created_at is not None
    assert checklist.api_key_created_at is not None
    assert checklist.first_trace_ingested_at is not None


def test_ingest_trace_requires_api_key(client):
    response = client.post(
        "/api/v1/ingest/traces",
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_123",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "API key is required"


def test_ingest_trace_rejects_invalid_api_key(client):
    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": "reliai_invalid"},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_123",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API key"


def test_ingest_trace_rejects_invalid_payload(client):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"authorization": f"Bearer {api_key_response['api_key']}"},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_123",
            "model_name": "gpt-4.1-mini",
            "latency_ms": -1,
            "success": True,
        },
    )

    assert response.status_code == 422


def test_ingest_trace_rejects_success_with_error_type(client):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_conflict",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "error_type": "provider_error",
        },
    )

    assert response.status_code == 422


def test_ingest_trace_rejects_excessive_retrieval_chunks(client):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_chunks",
            "model_name": "gpt-4.1-mini",
            "success": False,
            "retrieval": {
                "retrieved_chunks_json": [{"chunk_id": str(index)} for index in range(101)]
            },
        },
    )

    assert response.status_code == 422


def test_list_traces_filters_and_paginates(client, fake_queue):
    organization = create_organization(client)
    first_project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, first_project["id"])

    payloads = [
        {
            "timestamp": "2026-03-09T10:00:00Z",
            "request_id": "req_a",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
        },
        {
            "timestamp": "2026-03-09T11:00:00Z",
            "request_id": "req_b",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v2",
            "success": False,
            "error_type": "provider_error",
        },
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_c",
            "model_name": "claude-3-5-sonnet",
            "prompt_version": "v2",
            "success": True,
        },
    ]

    for payload in payloads:
        response = client.post(
            "/api/v1/ingest/traces",
            headers={"x-api-key": api_key_response["api_key"]},
            json=payload,
        )
        assert response.status_code == 202

    filtered = client.get(
        "/api/v1/traces",
        params={
            "project_id": first_project["id"],
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v2",
            "success": "false",
        },
    )
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["request_id"] == "req_b"

    first_page = client.get("/api/v1/traces", params={"project_id": first_project["id"], "limit": 2})
    assert first_page.status_code == 200
    first_page_payload = first_page.json()
    assert len(first_page_payload["items"]) == 2
    assert first_page_payload["next_cursor"] is not None

    second_page = client.get(
        "/api/v1/traces",
        params={"project_id": first_project["id"], "limit": 2, "cursor": first_page_payload["next_cursor"]},
    )
    assert second_page.status_code == 200
    second_page_payload = second_page.json()
    assert len(second_page_payload["items"]) == 1
    assert second_page_payload["items"][0]["request_id"] == "req_a"


def test_trace_detail_includes_retrieval_and_evaluations(client, db_session, fake_queue, monkeypatch):
    organization = create_organization(client)
    project = create_project(client, organization["id"])
    api_key_response = create_api_key(client, project["id"])

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_detail",
            "model_name": "gpt-4.1-mini",
            "output_text": "{\"status\":\"ok\"}",
            "success": True,
            "metadata_json": {"expected_output_format": "json"},
            "retrieval": {"source_count": 2, "query_text": "billing status"},
        },
    )
    assert response.status_code == 202
    trace_id = response.json()["trace_id"]

    monkeypatch.setattr("app.workers.evaluations.SessionLocal", lambda: db_session)
    run_trace_evaluations(trace_id)

    detail = client.get(f"/api/v1/traces/{trace_id}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["retrieval_span"]["source_count"] == 2
    assert len(payload["evaluations"]) == 1
    assert payload["evaluations"][0]["eval_type"] == STRUCTURED_VALIDITY_EVAL_TYPE
    assert payload["evaluations"][0]["label"] == "pass"

    stored_evaluation = db_session.query(Evaluation).filter(Evaluation.trace_id == UUID(trace_id)).one()
    assert stored_evaluation.label == "pass"
