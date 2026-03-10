from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.services.deployment_risk_engine import calculate_deployment_risk
from .test_api import auth_headers, create_operator, ingest_trace, sign_in
from .test_deployments import _create_deployment, _seed_project_with_versions
from .test_incidents import _run_signal_pipeline


def _seed_risky_deployment_data(client, db_session):
    session_payload, organization, project, api_key, prompt_version, model_version = _seed_project_with_versions(
        client, db_session
    )
    deployed_at = datetime(2026, 3, 9, 10, 0, tzinfo=timezone.utc)
    deployment = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=deployed_at,
    )

    for index in range(10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (deployed_at - timedelta(minutes=55) + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"risk-baseline-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 220,
                "prompt_tokens": 40,
                "completion_tokens": 10,
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
                "timestamp": (deployed_at + timedelta(minutes=5) + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"risk-current-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "not-json" if index < 7 else "{\"ok\":false}",
                "success": index >= 7,
                "error_type": "provider_error" if index < 7 else None,
                "latency_ms": 1450 if index < 7 else 1020,
                "prompt_tokens": 60,
                "completion_tokens": 15,
                "total_cost_usd": "0.020000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    return session_payload, organization, project, deployment


def test_calculate_deployment_risk_persists_expected_signals(client, db_session, fake_queue):
    _, _, _, deployment = _seed_risky_deployment_data(client, db_session)

    risk = calculate_deployment_risk(db_session, deployment_id=UUID(deployment["id"]))
    db_session.commit()

    assert risk.risk_level == "high"
    assert float(risk.risk_score) > 0.65
    assert risk.analysis_json["baseline_trace_count"] >= 10
    assert risk.analysis_json["current_trace_count"] == 10
    assert "success_rate" in risk.analysis_json["matched_regression_metrics"]
    signal_names = [item["signal_name"] for item in risk.analysis_json["signals"]]
    assert signal_names == [
        "structured_output_delta",
        "latency_delta",
        "error_rate_delta",
        "regression_signal",
    ]


def test_deployment_risk_api_is_tenant_safe_and_returns_recommendations(client, db_session, fake_queue):
    owner_session, _, _, deployment = _seed_risky_deployment_data(client, db_session)

    response = client.get(
        f"/api/v1/deployments/{deployment['id']}/risk",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["risk_level"] == "high"
    assert payload["analysis_json"]["current_error_rate"] > payload["analysis_json"]["baseline_error_rate"]
    assert payload["recommendations"]

    outsider = create_operator(db_session, email="deployment-risk-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/deployments/{deployment['id']}/risk",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403


def test_project_timeline_includes_deployment_risk_event(client, db_session, fake_queue):
    session_payload, _, project, deployment = _seed_risky_deployment_data(client, db_session)
    calculate_deployment_risk(db_session, deployment_id=UUID(deployment["id"]))
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/timeline",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    risk_item = next(
        item for item in response.json()["items"] if item["event_type"] == "deployment_risk_evaluated"
    )
    assert risk_item["metadata"]["deployment_id"] == deployment["id"]
    assert risk_item["metadata"]["path"] == f"/deployments/{deployment['id']}"
    assert risk_item["severity"] in {"medium", "high"}
    assert "Risk" in risk_item["summary"]


def test_deployment_detail_includes_latest_risk_score(client, db_session, fake_queue):
    session_payload, _, _, deployment = _seed_risky_deployment_data(client, db_session)
    calculate_deployment_risk(db_session, deployment_id=UUID(deployment["id"]))
    db_session.commit()

    response = client.get(
        f"/api/v1/deployments/{deployment['id']}",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["latest_risk_score"]["deployment_id"] == deployment["id"]
    assert payload["latest_risk_score"]["analysis_json"]["signals"]
