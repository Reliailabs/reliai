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
from .test_incidents import _incident_for_type, _run_signal_pipeline, _seed_success_rate_regression


def _list_registry_versions(client, session_payload: dict, project_id: str) -> tuple[dict, dict]:
    prompt_versions = client.get(
        f"/api/v1/projects/{project_id}/prompt-versions",
        headers=auth_headers(session_payload),
    )
    model_versions = client.get(
        f"/api/v1/projects/{project_id}/model-versions",
        headers=auth_headers(session_payload),
    )
    assert prompt_versions.status_code == 200
    assert model_versions.status_code == 200
    return prompt_versions.json()["items"][0], model_versions.json()["items"][0]


def _seed_incident_with_deployment(client, db_session):
    operator = create_operator(db_session, email="command-center-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name="Command Center Org",
        slug="command-center-org",
    )
    project = create_project(client, session_payload, organization["id"], name="Command Center Service")
    api_key = create_api_key(client, session_payload, project["id"])

    baseline_start = datetime(2026, 3, 9, 9, 0, 30, tzinfo=timezone.utc)
    current_start = datetime(2026, 3, 9, 10, 0, 30, tzinfo=timezone.utc)

    first_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": baseline_start.isoformat(),
            "request_id": "command-baseline-seed",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v2",
            "output_text": "{\"ok\":true}",
            "success": True,
            "latency_ms": 220,
            "total_cost_usd": "0.010000",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
    )
    _run_signal_pipeline(db_session, UUID(first_trace["trace_id"]))

    prompt_version, model_version = _list_registry_versions(client, session_payload, project["id"])
    deployment = client.post(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(session_payload),
        json={
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "environment": "prod",
            "deployed_by": "ops@acme.test",
            "deployed_at": datetime(2026, 3, 9, 9, 59, tzinfo=timezone.utc).isoformat(),
            "metadata_json": {"source": "command-center-test"},
        },
    )
    assert deployment.status_code == 201

    for index in range(1, 10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"command-baseline-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v2",
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
                "request_id": f"command-current-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v2",
                "output_text": "{\"ok\":false}" if index == 0 else "not-json",
                "success": index == 0,
                "error_type": None if index == 0 else "provider_error",
                "latency_ms": 300 if index == 0 else 1200,
                "total_cost_usd": "0.015000" if index == 0 else "0.040000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    return session_payload, project, api_key, incident, deployment.json()


def test_incident_command_center_is_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200

    outsider = create_operator(db_session, email="command-center-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 404


def test_incident_command_center_aggregates_signals(client, db_session, fake_queue):
    owner_session, project, api_key, incident, deployment = _seed_incident_with_deployment(client, db_session)

    policy = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(owner_session),
        json={
            "policy_type": "structured_output",
            "config_json": {"action": "block", "require_json": True},
            "is_active": True,
        },
    )
    assert policy.status_code == 201

    runtime_event = client.post(
        "/api/v1/runtime/guardrail-events",
        headers={"X-API-Key": api_key["api_key"]},
        json={
            "trace_id": incident.summary_json["sample_trace_ids"][0],
            "policy_id": policy.json()["id"],
            "action_taken": "block",
            "provider_model": "gpt-4.1-mini",
            "latency_ms": 910,
            "metadata_json": {"reason": "invalid_json_output"},
        },
    )
    assert runtime_event.status_code == 201

    response = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["incident"]["id"] == str(incident.id)
    assert payload["root_cause"]["root_cause_probabilities"]
    assert payload["root_cause"]["recommended_fix"]["summary"]
    assert payload["root_cause"]["evidence"]["graph_root_causes"]
    assert payload["trace_compare"]["failing_trace_summary"] is not None
    assert payload["trace_compare"]["compare_link"].startswith("/traces/")
    assert payload["deployment_context"] is not None
    assert payload["deployment_context"]["deployment"]["id"] == deployment["id"]
    assert payload["guardrail_activity"] == [
        {
            "policy_type": "structured_output",
            "trigger_count": 1,
            "last_trigger_time": runtime_event.json()["created_at"],
        }
    ]
    assert payload["related_regressions"]
    assert payload["recent_signals"]


def test_incident_command_center_handles_missing_deployment_and_guardrails(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    response = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["deployment_context"] is None
    assert payload["guardrail_activity"] == []
    assert payload["trace_compare"]["failing_trace_summary"] is not None
