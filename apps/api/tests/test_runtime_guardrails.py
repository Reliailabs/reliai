from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    sign_in,
)


def _seed_runtime_guardrail_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"runtime-guardrails-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Runtime Guardrails Org {suffix}",
        slug=f"runtime-guardrails-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Runtime Guardrails Service {suffix}",
    )
    api_key = create_api_key(client, session_payload, project["id"])
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "structured_output",
            "config_json": {"action": "block", "require_json": True},
            "is_active": True,
        },
    )
    assert create_response.status_code == 201
    return session_payload, project, api_key, create_response.json()


def test_runtime_guardrail_event_endpoint_accepts_project_api_key(client, db_session):
    session_payload, project, api_key, policy = _seed_runtime_guardrail_project(
        client,
        db_session,
        suffix="owner",
    )
    trace_id = "4d0d7b7f-4811-4272-94d1-1f125a04f2f1"

    response = client.post(
        "/api/v1/runtime/guardrail-events",
        headers={"X-API-Key": api_key["api_key"]},
        json={
            "trace_id": trace_id,
            "policy_id": policy["id"],
            "action_taken": "block",
            "provider_model": "gpt-4.1",
            "latency_ms": 812,
            "metadata_json": {"reason": "invalid_json_output"},
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["trace_id"] == trace_id
    assert payload["policy_id"] == policy["id"]
    assert payload["action_taken"] == "block"
    assert payload["provider_model"] == "gpt-4.1"

    timeline = client.get(
        f"/api/v1/projects/{project['id']}/timeline",
        headers=auth_headers(session_payload),
    )
    assert timeline.status_code == 200
    items = timeline.json()["items"]
    runtime_items = [item for item in items if item["event_type"] == "guardrail_runtime_enforced"]
    assert runtime_items
    assert runtime_items[0]["metadata"]["policy_id"] == policy["id"]
    assert runtime_items[0]["metadata"]["trace_id"] == trace_id


def test_runtime_guardrail_events_are_project_scoped(client, db_session):
    _, _, owner_api_key, _ = _seed_runtime_guardrail_project(
        client,
        db_session,
        suffix="owner-scope",
    )
    _, _, _, outsider_policy = _seed_runtime_guardrail_project(
        client,
        db_session,
        suffix="outsider-scope",
    )

    response = client.post(
        "/api/v1/runtime/guardrail-events",
        headers={"X-API-Key": owner_api_key["api_key"]},
        json={
            "trace_id": "ebecfbc5-a604-4118-8d0a-f522b7f7cccb",
            "policy_id": outsider_policy["id"],
            "action_taken": "retry",
            "provider_model": "gpt-4.1",
            "latency_ms": 1400,
            "metadata_json": {"reason": "latency_budget_exceeded"},
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Guardrail policy does not belong to project"
