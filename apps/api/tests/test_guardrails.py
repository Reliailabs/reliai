from uuid import UUID

from sqlalchemy import select

from app.models.guardrail_event import GuardrailEvent
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_guardrail_project(client, db_session):
    operator = create_operator(db_session, email="guardrails-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Guardrails Org", slug="guardrails-org")
    project = create_project(client, session_payload, organization["id"], name="Guardrails Service")
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def test_create_and_list_guardrail_policies(client, db_session):
    session_payload, project, _ = _seed_guardrail_project(client, db_session)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "cost_budget",
            "config_json": {"action": "block", "max_cost_usd": "0.020000"},
            "is_active": True,
        },
    )
    assert create_response.status_code == 201
    list_response = client.get(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
    )
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["policy_type"] == "cost_budget"


def test_guardrail_execution_creates_cost_budget_event(client, db_session, fake_queue):
    session_payload, project, api_key = _seed_guardrail_project(client, db_session)
    client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "cost_budget",
            "config_json": {"action": "block", "max_cost_usd": "0.020000"},
            "is_active": True,
        },
    )
    response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "guardrail-cost",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "output_text": "{\"ok\":true}",
            "latency_ms": 250,
            "prompt_tokens": 40,
            "completion_tokens": 10,
            "total_cost_usd": "0.050000",
            "success": True,
            "metadata_json": {"expected_output_format": "json"},
        },
    )
    event = db_session.scalar(select(GuardrailEvent).where(GuardrailEvent.trace_id == UUID(response["trace_id"])))
    assert event is not None
    assert event.action_taken == "block"


def test_guardrail_execution_creates_structured_output_event(client, db_session, fake_queue):
    session_payload, project, api_key = _seed_guardrail_project(client, db_session)
    client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "structured_output",
            "config_json": {"action": "retry", "require_json": True},
            "is_active": True,
        },
    )
    response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:02:00Z",
            "request_id": "guardrail-json",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "output_text": "not-json",
            "latency_ms": 250,
            "prompt_tokens": 40,
            "completion_tokens": 10,
            "total_cost_usd": "0.010000",
            "success": True,
            "metadata_json": {"expected_output_format": "json"},
        },
    )
    event = db_session.scalar(select(GuardrailEvent).where(GuardrailEvent.trace_id == UUID(response["trace_id"])))
    assert event is not None
    assert event.action_taken == "retry"
    assert event.metadata_json["reason"] == "invalid_json_output"


def test_guardrail_policies_are_tenant_safe(client, db_session):
    owner_session, project, _ = _seed_guardrail_project(client, db_session)
    client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(owner_session),
        json={
            "policy_type": "latency_retry",
            "config_json": {"action": "fallback_model", "max_latency_ms": 800, "fallback_model": "gpt-4.1-mini"},
            "is_active": True,
        },
    )

    outsider = create_operator(db_session, email="guardrails-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    response = client.get(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(outsider_session),
    )
    assert response.status_code == 403
