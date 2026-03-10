from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.trace import Trace
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    sign_in,
)


def _seed_guardrail_metrics_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"guardrail-metrics-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Guardrail Metrics Org {suffix}",
        slug=f"guardrail-metrics-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Guardrail Metrics Project {suffix}",
    )
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def test_guardrail_metrics_aggregates_policies_and_recent_events(client, db_session):
    session_payload, project, _ = _seed_guardrail_metrics_project(client, db_session, suffix="owner")
    structured_policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        policy_type="structured_output",
        config_json={"action": "retry", "require_json": True},
        is_active=True,
    )
    cost_policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        policy_type="cost_budget",
        config_json={"action": "block", "max_cost_usd": "0.25"},
        is_active=True,
    )
    db_session.add_all([structured_policy, cost_policy])
    db_session.commit()

    existing_trace_id = uuid4()
    missing_trace_id = uuid4()
    db_session.add(
        Trace(
            id=existing_trace_id,
            organization_id=UUID(project["organization_id"]),
            project_id=UUID(project["id"]),
            environment="prod",
            timestamp=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc),
            request_id="guardrail-metrics-trace",
            model_name="gpt-4.1",
            model_provider="openai",
            prompt_version="v1",
            success=True,
            is_explainable=True,
        )
    )
    db_session.add_all(
        [
            GuardrailRuntimeEvent(
                trace_id=existing_trace_id,
                policy_id=structured_policy.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=1200,
                metadata_json={"reason": "invalid_json_output"},
                created_at=datetime(2026, 3, 10, 15, 2, tzinfo=timezone.utc),
            ),
            GuardrailRuntimeEvent(
                trace_id=missing_trace_id,
                policy_id=structured_policy.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=1180,
                metadata_json={"reason": "invalid_json_output"},
                created_at=datetime(2026, 3, 10, 15, 4, tzinfo=timezone.utc),
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/guardrail-metrics",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert [policy["policy_type"] for policy in payload["policies"]] == [
        "structured_output",
        "cost_budget",
    ]
    assert payload["policies"][0]["trigger_count"] == 2
    assert payload["policies"][0]["action"] == "retry"
    assert payload["policies"][1]["trigger_count"] == 0
    assert payload["recent_events"][0]["trace_id"] == str(missing_trace_id)
    assert payload["recent_events"][0]["trace_available"] is False
    assert payload["recent_events"][1]["trace_id"] == str(existing_trace_id)
    assert payload["recent_events"][1]["trace_available"] is True


def test_guardrail_metrics_endpoint_accepts_project_api_key(client, db_session):
    _, project, api_key = _seed_guardrail_metrics_project(client, db_session, suffix="api-key")

    response = client.get(
        f"/api/v1/projects/{project['id']}/guardrail-metrics",
        headers={"x-api-key": api_key["api_key"]},
    )

    assert response.status_code == 200
    assert response.json() == {"policies": [], "recent_events": []}


def test_guardrail_metrics_are_tenant_safe(client, db_session):
    _, project, _ = _seed_guardrail_metrics_project(client, db_session, suffix="owner-scope")
    outsider_session, _, outsider_api_key = _seed_guardrail_metrics_project(
        client, db_session, suffix="outsider-scope"
    )

    session_response = client.get(
        f"/api/v1/projects/{project['id']}/guardrail-metrics",
        headers=auth_headers(outsider_session),
    )
    api_key_response = client.get(
        f"/api/v1/projects/{project['id']}/guardrail-metrics",
        headers={"x-api-key": outsider_api_key["api_key"]},
    )

    assert session_response.status_code == 403
    assert api_key_response.status_code == 403


def test_guardrail_metrics_empty_project_returns_deterministic_payload(client, db_session):
    session_payload, project, _ = _seed_guardrail_metrics_project(client, db_session, suffix="empty")

    response = client.get(
        f"/api/v1/projects/{project['id']}/guardrail-metrics",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    assert response.json() == {"policies": [], "recent_events": []}
