from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, select

from app.models.guardrail_effectiveness import GuardrailEffectiveness
from app.models.model_reliability_pattern import ModelReliabilityPattern
from app.models.prompt_failure_pattern import PromptFailurePattern
from app.services.deployment_simulation_engine import get_deployment_simulation, simulate_deployment
from app.workers.reliability_intelligence import run_reliability_intelligence_aggregation_for_session
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


def _seed_intelligence_project(client, db_session):
    owner = create_operator(db_session, email="intelligence-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Intelligence Org", slug="intelligence-org")
    project = create_project(client, session_payload, organization["id"], name="Intelligence Project")
    api_key = create_api_key(client, session_payload, project["id"])

    policy_response = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "structured_output",
            "config_json": {"action": "retry", "require_json": True},
            "is_active": True,
        },
    )
    assert policy_response.status_code == 201

    base_time = datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc)
    payloads = [
        {
            "timestamp": (base_time - timedelta(days=2)).isoformat(),
            "request_id": "intel-1",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v2",
            "latency_ms": 1200,
            "prompt_tokens": 180,
            "completion_tokens": 40,
            "success": False,
            "error_type": "provider_error",
            "output_text": "not-json",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
        {
            "timestamp": (base_time - timedelta(days=3)).isoformat(),
            "request_id": "intel-2",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v2",
            "latency_ms": 900,
            "prompt_tokens": 220,
            "completion_tokens": 50,
            "success": False,
            "error_type": "timeout",
            "output_text": "not-json",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
        {
            "timestamp": (base_time - timedelta(days=4)).isoformat(),
            "request_id": "intel-3",
            "model_name": "claude-3-5-sonnet",
            "model_provider": "anthropic",
            "prompt_version": "v7",
            "latency_ms": 320,
            "prompt_tokens": 90,
            "completion_tokens": 25,
            "success": True,
            "output_text": "{\"ok\": true}",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-01"},
        },
    ]

    for payload in payloads:
        response = ingest_trace(client, api_key["api_key"], payload)
        trace_id = UUID(response["trace_id"])
        _run_signal_pipeline(db_session, trace_id)
        run_trace_warehouse_ingest(str(trace_id))

    prompt_versions = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    model_versions = client.get(
        f"/api/v1/projects/{project['id']}/model-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    return session_payload, project, api_key, prompt_versions[0], model_versions[0]


def test_reliability_intelligence_aggregation_persists_patterns_and_effectiveness(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
):
    _seed_intelligence_project(client, db_session)

    run_reliability_intelligence_aggregation_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 13, 0, tzinfo=timezone.utc).isoformat(),
    )

    model_pattern = db_session.scalar(
        select(ModelReliabilityPattern).where(
            ModelReliabilityPattern.provider == "openai",
            ModelReliabilityPattern.model_name == "gpt-4.1-mini",
        )
    )
    prompt_pattern = db_session.scalars(
        select(PromptFailurePattern).order_by(desc(PromptFailurePattern.failure_rate))
    ).first()
    guardrail_effectiveness = db_session.scalar(select(GuardrailEffectiveness))

    assert model_pattern is not None
    assert model_pattern.structured_output_failure_rate > 0.9
    assert "provider_error" in model_pattern.failure_modes
    assert model_pattern.latency_percentiles["p95"] >= 900
    assert prompt_pattern is not None
    assert prompt_pattern.failure_rate > 0.5
    assert guardrail_effectiveness is not None
    assert guardrail_effectiveness.policy_type == "structured_output"
    assert guardrail_effectiveness.action == "retry"


def test_intelligence_endpoints_return_aggregated_rows(client, db_session, fake_queue, fake_trace_warehouse):
    _seed_intelligence_project(client, db_session)
    run_reliability_intelligence_aggregation_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 13, 0, tzinfo=timezone.utc).isoformat(),
    )

    models_response = client.get("/api/v1/intelligence/models")
    prompts_response = client.get("/api/v1/intelligence/prompts")
    guardrails_response = client.get("/api/v1/intelligence/guardrails")

    assert models_response.status_code == 200
    assert prompts_response.status_code == 200
    assert guardrails_response.status_code == 200
    assert models_response.json()["items"][0]["provider"] == "openai"
    assert "failure_modes" in models_response.json()["items"][0]
    assert prompts_response.json()["items"][0]["prompt_pattern_hash"]
    assert guardrails_response.json()["items"][0]["policy_type"] == "structured_output"


def test_deployment_simulation_includes_network_risk_adjustment(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
    monkeypatch,
):
    session_payload, project, _, prompt_version, model_version = _seed_intelligence_project(client, db_session)
    run_reliability_intelligence_aggregation_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 13, 0, tzinfo=timezone.utc).isoformat(),
    )
    monkeypatch.setattr("app.services.deployment_simulation_engine._utcnow", lambda: datetime(2026, 3, 10, 13, 0, tzinfo=timezone.utc))

    response = client.post(
        f"/api/v1/projects/{project['id']}/deployments/simulate",
        headers=auth_headers(session_payload),
        json={
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "sample_size": 2,
        },
    )
    assert response.status_code == 202
    simulation_id = UUID(response.json()["id"])

    simulate_deployment(db_session, simulation_id=simulation_id)
    db_session.commit()
    simulation = get_deployment_simulation(db_session, simulation_id=simulation_id)

    assert simulation is not None
    adjustment = simulation.analysis_json["network_risk_adjustment"]
    assert adjustment["value"] > 0
    assert simulation.analysis_json["score_components"]["network_risk_adjustment"] > 0
