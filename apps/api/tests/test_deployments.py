from datetime import datetime, timedelta, timezone
from uuid import UUID

from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_project_with_versions(client, db_session):
    operator = create_operator(db_session, email="deployments-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Deployments Org", slug="deployments-org")
    project = create_project(client, session_payload, organization["id"], name="Deployments Service")
    api_key = create_api_key(client, session_payload, project["id"])
    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T09:00:00Z",
            "request_id": "deployment-seed",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "latency_ms": 180,
            "prompt_tokens": 40,
            "completion_tokens": 10,
            "success": True,
            "output_text": "{\"ok\":true}",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
    )
    prompt_versions = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    model_versions = client.get(
        f"/api/v1/projects/{project['id']}/model-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    return session_payload, organization, project, api_key, prompt_versions[0], model_versions[0]


def _create_deployment(client, session_payload, project_id: str, *, prompt_version_id: str, model_version_id: str, deployed_at: datetime):
    response = client.post(
        f"/api/v1/projects/{project_id}/deployments",
        headers=auth_headers(session_payload),
        json={
            "prompt_version_id": prompt_version_id,
            "model_version_id": model_version_id,
            "environment": "prod",
            "deployed_by": "ops@acme.test",
            "deployed_at": deployed_at.isoformat(),
            "metadata_json": {"source": "github-actions"},
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_list_and_get_deployments(client, db_session):
    session_payload, _, project, _, prompt_version, model_version = _seed_project_with_versions(client, db_session)
    deployed_at = datetime(2026, 3, 9, 11, 30, tzinfo=timezone.utc)

    created = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=deployed_at,
    )

    listed = client.get(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(session_payload),
    )
    assert listed.status_code == 200
    assert listed.json()["items"][0]["id"] == created["id"]

    detail = client.get(
        f"/api/v1/deployments/{created['id']}",
        headers=auth_headers(session_payload),
    )
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["prompt_version"]["id"] == prompt_version["id"]
    assert payload["model_version"]["id"] == model_version["id"]
    assert payload["events"][0]["event_type"] == "created"
    assert payload["gate"]["decision"] in {"ALLOW", "WARN", "BLOCK"}
    assert isinstance(payload["gate"]["risk_score"], int)
    assert isinstance(payload["gate"]["explanations"], list)
    assert isinstance(payload["gate"]["recommended_guardrails"], list)


def test_get_deployment_gate_returns_safety_decision(client, db_session):
    session_payload, _, project, _, prompt_version, model_version = _seed_project_with_versions(client, db_session)
    created = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=datetime(2026, 3, 9, 11, 30, tzinfo=timezone.utc),
    )

    response = client.get(
        f"/api/v1/deployments/{created['id']}/gate",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] in {"ALLOW", "WARN", "BLOCK"}
    assert isinstance(payload["risk_score"], int)
    assert payload["risk_score"] >= 0
    assert isinstance(payload["explanations"], list)
    assert isinstance(payload["recommended_guardrails"], list)


def test_deployment_endpoints_are_tenant_safe(client, db_session):
    owner_session, _, project, _, prompt_version, model_version = _seed_project_with_versions(client, db_session)
    created = _create_deployment(
        client,
        owner_session,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=datetime(2026, 3, 9, 11, 30, tzinfo=timezone.utc),
    )

    outsider = create_operator(db_session, email="deployments-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)

    detail = client.get(
        f"/api/v1/deployments/{created['id']}",
        headers=auth_headers(outsider_session),
    )
    project_list = client.get(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(outsider_session),
    )
    assert detail.status_code == 403
    assert project_list.status_code == 403


def test_incident_links_to_most_recent_deployment(client, db_session):
    session_payload, _, project, api_key, prompt_version, model_version = _seed_project_with_versions(client, db_session)
    older = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=datetime(2026, 3, 9, 9, 30, tzinfo=timezone.utc),
    )
    newer = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=datetime(2026, 3, 9, 9, 59, tzinfo=timezone.utc),
    )
    baseline_start = datetime(2026, 3, 9, 10, 0, tzinfo=timezone.utc)
    current_start = datetime(2026, 3, 9, 11, 0, 30, tzinfo=timezone.utc)

    from .test_incidents import _incident_for_type, _run_signal_pipeline

    for index in range(10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"deployment-baseline-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 220,
                "total_cost_usd": "0.010000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    for index in range(10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"deployment-current-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "not-json",
                "success": False,
                "error_type": "provider_error",
                "latency_ms": 1200,
                "total_cost_usd": "0.040000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    assert str(incident.deployment_id) == newer["id"]
    assert str(incident.deployment_id) != older["id"]

    detail = client.get(
        f"/api/v1/incidents/{incident.id}",
        headers=auth_headers(session_payload),
    )
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["deployment_context"]["deployment"]["id"] == newer["id"]
    assert payload["deployment_context"]["prompt_version"]["id"] == prompt_version["id"]
    assert payload["deployment_context"]["model_version"]["id"] == model_version["id"]
    expected_minutes = round(
        (
            incident.started_at
            - datetime.fromisoformat(newer["deployed_at"].replace("Z", "+00:00"))
        ).total_seconds()
        / 60.0,
        2,
    )
    assert payload["deployment_context"]["time_since_deployment_minutes"] == expected_minutes
