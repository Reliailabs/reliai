from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.services.deployment_simulation_engine import get_deployment_simulation, simulate_deployment
from app.workers.trace_warehouse_ingest import run_trace_warehouse_ingest
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)
from .test_incidents import _run_signal_pipeline


def _seed_project_with_registry(client, db_session):
    owner = create_operator(db_session, email="simulation-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Simulation Org", slug="simulation-org")
    project = create_project(client, session_payload, organization["id"], name="Simulation Project")
    api_key = create_api_key(client, session_payload, project["id"])
    seed = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "simulation-registry-seed",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v2",
            "latency_ms": 200,
            "prompt_tokens": 40,
            "completion_tokens": 20,
            "success": True,
            "output_text": "{\"ok\": true}",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
    )
    _run_signal_pipeline(db_session, UUID(seed["trace_id"]))
    prompt_versions = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    model_versions = client.get(
        f"/api/v1/projects/{project['id']}/model-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    return session_payload, organization, project, api_key, prompt_versions[0], model_versions[0]


def test_create_deployment_simulation_queues_async_job(client, db_session, fake_queue):
    session_payload, _, project, _, prompt_version, model_version = _seed_project_with_registry(client, db_session)

    response = client.post(
        f"/api/v1/projects/{project['id']}/deployments/simulate",
        headers=auth_headers(session_payload),
        json={
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "sample_size": 12,
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["project_id"] == project["id"]
    assert payload["trace_sample_size"] == 12
    assert payload["analysis_json"]["status"] == "queued"
    assert fake_queue.jobs[-1][0].__name__ == "run_deployment_simulation"


def test_simulation_uses_historical_sampling_and_appears_in_timeline(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
    monkeypatch,
):
    session_payload, _, project, api_key, prompt_version, model_version = _seed_project_with_registry(
        client, db_session
    )
    now = datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(
        "app.services.deployment_simulation_engine._utcnow",
        lambda: now,
    )

    for index in range(2):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (now - timedelta(days=1, minutes=index)).isoformat(),
                "request_id": f"simulation-recent-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v2",
                "latency_ms": 950 + (index * 50),
                "prompt_tokens": 55,
                "completion_tokens": 24,
                "success": False,
                "error_type": "provider_error",
                "output_text": "not-json",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    for index in range(3):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (now - timedelta(days=12, minutes=index)).isoformat(),
                "request_id": f"simulation-historical-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v2",
                "latency_ms": 1100 + (index * 25),
                "prompt_tokens": 60,
                "completion_tokens": 28,
                "success": False,
                "error_type": "provider_error",
                "output_text": "not-json",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        trace_id = UUID(response["trace_id"])
        _run_signal_pipeline(db_session, trace_id)
        run_trace_warehouse_ingest(str(trace_id))

    response = client.post(
        f"/api/v1/projects/{project['id']}/deployments/simulate",
        headers=auth_headers(session_payload),
        json={
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "sample_size": 4,
        },
    )
    assert response.status_code == 202
    simulation_id = UUID(response.json()["id"])

    simulate_deployment(db_session, simulation_id=simulation_id)
    db_session.commit()

    simulation = get_deployment_simulation(db_session, simulation_id=simulation_id)
    assert simulation is not None
    assert simulation.analysis_json["status"] == "completed"
    assert simulation.analysis_json["sample_strategy"] == "recent_plus_historical_exact"
    assert simulation.analysis_json["historical_sample_count"] >= 3
    assert simulation.predicted_failure_rate is not None and float(simulation.predicted_failure_rate) >= 0.7
    assert simulation.predicted_latency_ms is not None and float(simulation.predicted_latency_ms) >= 800
    assert simulation.risk_level in {"medium", "high"}

    timeline_response = client.get(
        f"/api/v1/projects/{project['id']}/timeline",
        headers=auth_headers(session_payload),
    )
    assert timeline_response.status_code == 200
    timeline_items = timeline_response.json()["items"]
    simulation_items = [
        item for item in timeline_items if item["event_type"] == "deployment_simulation_completed"
    ]
    assert simulation_items
    assert simulation_items[0]["metadata"]["deployment_simulation_id"] == str(simulation_id)
    assert simulation_items[0]["metadata"]["path"].startswith("/prompt-versions/")
