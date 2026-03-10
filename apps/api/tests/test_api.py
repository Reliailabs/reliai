from uuid import UUID

from app.models.api_key import APIKey
from app.models.evaluation import Evaluation
from app.models.model_version import ModelVersion
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.models.prompt_version import PromptVersion
from app.models.retrieval_span import RetrievalSpan
from app.models.trace import Trace
from app.services.event_stream import TRACE_INGESTED_EVENT
from app.services.auth import create_operator_user
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.workers.evaluations import run_trace_evaluations


def create_operator(db_session, *, email: str, password: str = "reliai-test-password"):
    operator = create_operator_user(db_session, email=email, password=password)
    db_session.commit()
    db_session.refresh(operator)
    return operator


def sign_in(client, *, email: str, password: str = "reliai-test-password") -> dict:
    response = client.post(
        "/api/v1/auth/sign-in",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def auth_headers(session_payload: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {session_payload['session_token']}"}


def create_organization(client, session_payload: dict, *, name: str, slug: str) -> dict:
    response = client.post(
        "/api/v1/organizations",
        headers=auth_headers(session_payload),
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


def create_project(client, session_payload: dict, organization_id: str, *, name: str = "Support Copilot") -> dict:
    response = client.post(
        f"/api/v1/organizations/{organization_id}/projects",
        headers=auth_headers(session_payload),
        json={
            "name": name,
            "environment": "prod",
            "description": "Primary production app",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_api_key(client, session_payload: dict, project_id: str) -> dict:
    response = client.post(
        f"/api/v1/projects/{project_id}/api-keys",
        headers=auth_headers(session_payload),
        json={"label": "Production ingest"},
    )
    assert response.status_code == 201
    return response.json()


def ingest_trace(client, api_key: str, payload: dict) -> dict:
    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key},
        json=payload,
    )
    assert response.status_code == 202
    return response.json()


def test_health_endpoints(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_auth_session_flow(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)

    session_response = client.get("/api/v1/auth/session", headers=auth_headers(session_payload))
    assert session_response.status_code == 200
    assert session_response.json()["operator"]["email"] == operator.email

    sign_out_response = client.post("/api/v1/auth/sign-out", headers=auth_headers(session_payload))
    assert sign_out_response.status_code == 204

    expired_session = client.get("/api/v1/auth/session", headers=auth_headers(session_payload))
    assert expired_session.status_code == 401


def test_operator_can_create_and_fetch_organization_and_project(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)

    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")

    organization_fetch = client.get(
        f"/api/v1/organizations/{organization['id']}",
        headers=auth_headers(session_payload),
    )
    assert organization_fetch.status_code == 200
    assert organization_fetch.json()["slug"] == "acme-ai"

    project = create_project(client, session_payload, organization["id"])
    project_fetch = client.get(
        f"/api/v1/projects/{project['id']}",
        headers=auth_headers(session_payload),
    )
    assert project_fetch.status_code == 200
    assert project_fetch.json()["environment"] == "production"


def test_create_organization_rejects_owner_mismatch(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)

    response = client.post(
        "/api/v1/organizations",
        headers=auth_headers(session_payload),
        json={
            "name": "Acme AI",
            "slug": "acme-ai",
            "plan": "pilot",
            "owner_auth_user_id": "someone-else",
            "owner_role": "owner",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden"


def test_duplicate_organization_slug_returns_conflict(client, db_session):
    first_operator = create_operator(db_session, email="first@acme.test")
    first_session = sign_in(client, email=first_operator.email)
    create_organization(client, first_session, name="Acme AI", slug="acme-ai")

    second_operator = create_operator(db_session, email="second@acme.test")
    second_session = sign_in(client, email=second_operator.email)
    response = client.post(
        "/api/v1/organizations",
        headers=auth_headers(second_session),
        json={
            "name": "Acme AI Duplicate",
            "slug": "acme-ai",
            "plan": "pilot",
            "owner_auth_user_id": second_session["operator"]["id"],
            "owner_role": "owner",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Organization slug already exists"


def test_create_api_key_hashes_secret(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    project = create_project(client, session_payload, organization["id"])
    api_key_response = create_api_key(client, session_payload, project["id"])

    key_record = db_session.get(APIKey, UUID(api_key_response["api_key_record"]["id"]))
    assert key_record is not None
    assert api_key_response["api_key"].startswith("reliai_")
    assert key_record.key_hash != api_key_response["api_key"]


def test_tenant_authorization_blocks_cross_org_access(client, db_session):
    owner_one = create_operator(db_session, email="owner-one@acme.test")
    owner_two = create_operator(db_session, email="owner-two@beta.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    owner_two_session = sign_in(client, email=owner_two.email)

    organization = create_organization(client, owner_one_session, name="Acme AI", slug="acme-ai")
    project = create_project(client, owner_one_session, organization["id"])

    organization_response = client.get(
        f"/api/v1/organizations/{organization['id']}",
        headers=auth_headers(owner_two_session),
    )
    project_response = client.get(
        f"/api/v1/projects/{project['id']}",
        headers=auth_headers(owner_two_session),
    )
    api_key_response = client.post(
        f"/api/v1/projects/{project['id']}/api-keys",
        headers=auth_headers(owner_two_session),
        json={"label": "Blocked"},
    )

    assert organization_response.status_code == 403
    assert project_response.status_code == 403
    assert api_key_response.status_code == 403


def test_ingest_trace_happy_path(client, db_session, fake_event_stream):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    project = create_project(client, session_payload, organization["id"])
    api_key_response = create_api_key(client, session_payload, project["id"])

    payload = ingest_trace(
        client,
        api_key_response["api_key"],
        {
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

    stored_trace = db_session.get(Trace, UUID(payload["trace_id"]))
    assert stored_trace is not None
    assert stored_trace.organization_id == UUID(organization["id"])
    assert stored_trace.environment == "production"
    assert stored_trace.output_preview == "Hi"
    assert stored_trace.is_explainable is True

    retrieval_span = db_session.query(RetrievalSpan).filter(RetrievalSpan.trace_id == stored_trace.id).one()
    assert retrieval_span.source_count == 3
    assert stored_trace.prompt_version_record_id is not None
    assert stored_trace.model_version_record_id is not None
    prompt_record = db_session.get(PromptVersion, stored_trace.prompt_version_record_id)
    model_record = db_session.get(ModelVersion, stored_trace.model_version_record_id)
    assert prompt_record is not None
    assert prompt_record.version == "v1"
    assert model_record is not None
    project_record = db_session.get(Project, UUID(project["id"]))
    assert project_record is not None
    assert project_record.last_trace_received_at is not None
    assert model_record.model_name == "gpt-4.1-mini"
    assert len(list(fake_event_stream.consume("trace_events"))) == 1
    message = next(fake_event_stream.consume("trace_events"))
    assert message.event_type == TRACE_INGESTED_EVENT
    assert message.key == project["id"]
    assert message.payload["trace_id"] == str(stored_trace.id)


def test_project_registry_listing_is_tenant_safe(client, db_session, fake_queue):
    owner = create_operator(db_session, email="owner@acme.test")
    outsider = create_operator(db_session, email="outsider@beta.test")
    owner_session = sign_in(client, email=owner.email)
    outsider_session = sign_in(client, email=outsider.email)
    organization = create_organization(client, owner_session, name="Acme AI", slug="acme-ai")
    project = create_project(client, owner_session, organization["id"])
    api_key_response = create_api_key(client, owner_session, project["id"])

    ingest_trace(
        client,
        api_key_response["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_registry",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v9",
            "success": True,
        },
    )

    prompt_versions = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(owner_session),
    )
    assert prompt_versions.status_code == 200
    assert prompt_versions.json()["items"][0]["version"] == "v9"

    model_versions = client.get(
        f"/api/v1/projects/{project['id']}/model-versions",
        headers=auth_headers(owner_session),
    )
    assert model_versions.status_code == 200
    assert model_versions.json()["items"][0]["model_name"] == "gpt-4.1-mini"

    forbidden = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403


def test_ingest_trace_requires_valid_api_key(client):
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

    invalid_response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": "reliai_invalid"},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_123",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )
    assert invalid_response.status_code == 401
    assert invalid_response.json()["detail"] == "Invalid API key"


def test_ingest_trace_rejects_invalid_payload_bounds(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    project = create_project(client, session_payload, organization["id"])
    api_key_response = create_api_key(client, session_payload, project["id"])

    invalid_success = client.post(
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
    assert invalid_success.status_code == 422

    oversized_metadata = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_meta",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "metadata_json": {"payload": "x" * 17000},
        },
    )
    assert oversized_metadata.status_code == 422

    oversized_input = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key_response["api_key"]},
        json={
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_input",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "input_text": "x" * 20001,
        },
    )
    assert oversized_input.status_code == 422


def test_trace_list_filters_pagination_and_tenant_scope(client, db_session):
    owner_one = create_operator(db_session, email="owner-one@acme.test")
    owner_two = create_operator(db_session, email="owner-two@beta.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    owner_two_session = sign_in(client, email=owner_two.email)

    organization_one = create_organization(client, owner_one_session, name="Acme AI", slug="acme-ai")
    project_one = create_project(client, owner_one_session, organization_one["id"])
    api_key_one = create_api_key(client, owner_one_session, project_one["id"])

    organization_two = create_organization(client, owner_two_session, name="Beta AI", slug="beta-ai")
    project_two = create_project(client, owner_two_session, organization_two["id"], name="Beta Agent")
    api_key_two = create_api_key(client, owner_two_session, project_two["id"])

    for payload in [
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
    ]:
        ingest_trace(client, api_key_one["api_key"], payload)

    ingest_trace(
        client,
        api_key_two["api_key"],
        {
            "timestamp": "2026-03-09T09:00:00Z",
            "request_id": "req_other_org",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )

    filtered = client.get(
        "/api/v1/traces",
        headers=auth_headers(owner_one_session),
        params={
            "project_id": project_one["id"],
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v2",
            "success": "false",
        },
    )
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["request_id"] == "req_b"

    first_page = client.get(
        "/api/v1/traces",
        headers=auth_headers(owner_one_session),
        params={"project_id": project_one["id"], "limit": 2},
    )
    assert first_page.status_code == 200
    first_page_payload = first_page.json()
    assert len(first_page_payload["items"]) == 2
    assert first_page_payload["next_cursor"] is not None
    assert {item["request_id"] for item in first_page_payload["items"]} == {"req_b", "req_c"}

    second_page = client.get(
        "/api/v1/traces",
        headers=auth_headers(owner_one_session),
        params={"project_id": project_one["id"], "limit": 2, "cursor": first_page_payload["next_cursor"]},
    )
    assert second_page.status_code == 200
    second_page_payload = second_page.json()
    assert len(second_page_payload["items"]) == 1
    assert second_page_payload["items"][0]["request_id"] == "req_a"

    tenant_only = client.get("/api/v1/traces", headers=auth_headers(owner_one_session))
    assert tenant_only.status_code == 200
    assert {item["request_id"] for item in tenant_only.json()["items"]} == {"req_a", "req_b", "req_c"}

    escaped_filter = client.get(
        "/api/v1/traces",
        headers=auth_headers(owner_one_session),
        params={"project_id": project_two["id"]},
    )
    assert escaped_filter.status_code == 403


def test_trace_detail_is_tenant_safe_and_includes_evaluations(client, db_session, fake_queue, monkeypatch):
    owner_one = create_operator(db_session, email="owner-one@acme.test")
    owner_two = create_operator(db_session, email="owner-two@beta.test")
    owner_one_session = sign_in(client, email=owner_one.email)
    owner_two_session = sign_in(client, email=owner_two.email)

    organization = create_organization(client, owner_one_session, name="Acme AI", slug="acme-ai")
    project = create_project(client, owner_one_session, organization["id"])
    api_key_response = create_api_key(client, owner_one_session, project["id"])

    accepted = ingest_trace(
        client,
        api_key_response["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "req_detail",
            "model_name": "gpt-4.1-mini",
            "output_text": "{\"status\":\"ok\"}",
            "success": True,
            "metadata_json": {"expected_output_format": "json"},
            "retrieval": {"source_count": 2, "query_text": "billing status"},
        },
    )
    trace_id = accepted["trace_id"]

    monkeypatch.setattr("app.workers.evaluations.SessionLocal", lambda: db_session)
    monkeypatch.setattr("app.processors.evaluation_processor.SessionLocal", lambda: db_session)
    run_trace_evaluations(trace_id)

    detail = client.get(f"/api/v1/traces/{trace_id}", headers=auth_headers(owner_one_session))
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["retrieval_span"]["source_count"] == 2
    assert len(payload["evaluations"]) == 1
    assert payload["evaluations"][0]["eval_type"] == STRUCTURED_VALIDITY_EVAL_TYPE
    assert payload["evaluations"][0]["label"] == "pass"

    forbidden = client.get(f"/api/v1/traces/{trace_id}", headers=auth_headers(owner_two_session))
    assert forbidden.status_code == 404

    stored_evaluation = db_session.query(Evaluation).filter(Evaluation.trace_id == UUID(trace_id)).one()
    assert stored_evaluation.label == "pass"


def test_membership_row_created_for_operator_owned_organization(client, db_session):
    operator = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")

    membership = (
        db_session.query(OrganizationMember)
        .filter(
            OrganizationMember.organization_id == UUID(organization["id"]),
            OrganizationMember.auth_user_id == str(operator.id),
        )
        .one()
    )
    assert membership.role == "owner"
