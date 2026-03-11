from uuid import UUID

from app.models.trace import Trace
from app.services.auth import create_operator_user


def create_operator(
    db_session,
    *,
    email: str,
    password: str = "reliai-test-password",
):
    operator = create_operator_user(
        db_session,
        email=email,
        password=password,
    )
    db_session.commit()
    db_session.refresh(operator)
    return operator


def sign_in(client, *, email: str, password: str = "reliai-test-password") -> dict:
    response = client.post("/api/v1/auth/sign-in", json={"email": email, "password": password})
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


def create_project(client, session_payload: dict, organization_id: str, *, name: str = "Span Graph") -> dict:
    response = client.post(
        f"/api/v1/organizations/{organization_id}/projects",
        headers=auth_headers(session_payload),
        json={
            "name": name,
            "environment": "prod",
            "description": "Span-aware project",
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
    response = client.post("/api/v1/ingest/traces", headers={"x-api-key": api_key}, json=payload)
    assert response.status_code == 202
    return response.json()


def test_ingest_promotes_span_fields_and_trace_graph_endpoint(client, db_session):
    operator = create_operator(db_session, email="trace-graph@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Acme Graph", slug="acme-graph")
    project = create_project(client, session, organization["id"])
    api_key = create_api_key(client, session, project["id"])["api_key"]

    shared_trace_id = "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535111"
    root = ingest_trace(
        client,
        api_key,
        {
            "timestamp": "2026-03-11T12:00:00Z",
            "request_id": "root-span",
            "trace_id": shared_trace_id,
            "span_id": "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535112",
            "span_name": "request",
            "metadata_json": {
                "span_type": "llm_call",
                "model_parameters": {"temperature": 0.2, "api_key": "sk-secret"},
            },
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "success": True,
            "input_text": "root",
            "output_text": "ok",
            "prompt_tokens": 120,
            "completion_tokens": 80,
            "latency_ms": 1200,
        },
    )
    ingest_trace(
        client,
        api_key,
        {
            "timestamp": "2026-03-11T12:00:01Z",
            "request_id": "child-span",
            "trace_id": shared_trace_id,
            "span_id": "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535113",
            "parent_span_id": "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535112",
            "span_name": "guardrail",
            "guardrail_policy": "structured_output",
            "guardrail_action": "retry",
            "metadata_json": {"span_type": "guardrail", "authorization": "Bearer secret-token"},
            "model_name": "gpt-4.1",
            "model_provider": "openai",
            "success": True,
            "input_text": "child",
            "output_text": "{\"ok\":true}",
            "latency_ms": 300,
        },
    )

    stored = db_session.get(Trace, UUID(root["trace_id"]))
    assert stored is not None
    assert stored.trace_id == shared_trace_id
    assert stored.span_name == "request"

    graph_response = client.get(
        f"/api/v1/traces/{shared_trace_id}/graph",
        headers=auth_headers(session),
    )
    assert graph_response.status_code == 200
    payload = graph_response.json()
    assert payload["trace_id"] == shared_trace_id
    assert len(payload["nodes"]) == 2
    assert payload["edges"] == [
        {
            "parent_span_id": "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535112",
            "child_span_id": "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535113",
        }
    ]
    assert payload["nodes"][0]["span_type"] == "llm_call"

    analysis_response = client.get(
        f"/api/v1/traces/{shared_trace_id}/analysis",
        headers=auth_headers(session),
    )
    assert analysis_response.status_code == 200
    analysis = analysis_response.json()
    assert analysis["slowest_span"]["span_id"] == "0d8e2a7a-4f13-4eeb-95d8-ef9a6a535112"
    assert analysis["largest_token_span"]["token_count"] == 200
    assert analysis["most_guardrail_retries"]["guardrail_policy"] == "structured_output"
    assert analysis["most_guardrail_retries"]["retry_count"] == 1

    replay_response = client.get(
        f"/api/v1/traces/{shared_trace_id}/replay",
        headers=auth_headers(session),
    )
    assert replay_response.status_code == 200
    replay = replay_response.json()
    assert len(replay["steps"]) == 2
    assert replay["steps"][0]["span_type"] == "llm_call"
    assert replay["steps"][0]["parameters"]["temperature"] == 0.2
    assert replay["steps"][0]["parameters"]["api_key"] == "[REDACTED]"
    assert replay["steps"][1]["inputs"]["action"] == "retry"


def test_trace_detail_includes_promoted_span_fields(client, db_session):
    operator = create_operator(db_session, email="trace-detail@acme.test")
    session = sign_in(client, email=operator.email)
    organization = create_organization(client, session, name="Acme Detail", slug="acme-detail")
    project = create_project(client, session, organization["id"])
    api_key = create_api_key(client, session, project["id"])["api_key"]

    accepted = ingest_trace(
        client,
        api_key,
        {
            "timestamp": "2026-03-11T13:00:00Z",
            "request_id": "detail-span",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "trace_id": "4a8b9040-e028-4d0c-8f35-5ddb1b781001",
            "span_id": "4a8b9040-e028-4d0c-8f35-5ddb1b781002",
            "parent_span_id": "4a8b9040-e028-4d0c-8f35-5ddb1b781003",
            "span_name": "llm_call",
            "guardrail_policy": "latency_retry",
            "guardrail_action": "retry",
        },
    )

    response = client.get(
        f"/api/v1/traces/{accepted['trace_id']}",
        headers=auth_headers(session),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["trace_id"] == "4a8b9040-e028-4d0c-8f35-5ddb1b781001"
    assert payload["span_id"] == "4a8b9040-e028-4d0c-8f35-5ddb1b781002"
    assert payload["parent_span_id"] == "4a8b9040-e028-4d0c-8f35-5ddb1b781003"
    assert payload["span_name"] == "llm_call"
    assert payload["guardrail_policy"] == "latency_retry"
    assert payload["guardrail_action"] == "retry"
