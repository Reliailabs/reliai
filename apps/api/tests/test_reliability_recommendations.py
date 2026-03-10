from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.deployment_simulation import DeploymentSimulation
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.reliability_metric import ReliabilityMetric
from app.models.reliability_recommendation import ReliabilityRecommendation
from app.services.reliability_recommendations import generate_recommendations
from app.workers.reliability_recommendations import run_project_reliability_recommendations_for_session
from app.workers.reliability_sweep import run_reliability_sweep_for_session
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in
from .test_reliability_metrics import _seed_metric_inputs


def _seed_recommendation_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"recommendations-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Recommendations Org {suffix}",
        slug=f"recommendations-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Recommendations Project {suffix}",
    )
    return session_payload, organization, project


def test_generate_recommendations_persists_deterministic_operator_actions(client, db_session, monkeypatch):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.reliability_recommendations._utc_now", lambda: now)
    session_payload, _, project = _seed_recommendation_project(client, db_session, suffix="aggregate")
    project_id = UUID(project["id"])

    db_session.add_all(
        [
            ReliabilityMetric(
                organization_id=UUID(project["organization_id"]),
                project_id=project_id,
                scope_type="project",
                scope_id=str(project_id),
                metric_name="structured_output_validity_rate",
                window_minutes=60,
                window_start=now - timedelta(hours=1),
                window_end=now,
                value_number=0.78,
                numerator=78,
                denominator=100,
                unit="ratio",
                computed_at=now,
            ),
            ReliabilityMetric(
                organization_id=UUID(project["organization_id"]),
                project_id=project_id,
                scope_type="project",
                scope_id=str(project_id),
                metric_name="quality_pass_rate",
                window_minutes=60,
                window_start=now - timedelta(hours=1),
                window_end=now,
                value_number=0.84,
                numerator=84,
                denominator=100,
                unit="ratio",
                computed_at=now,
            ),
        ]
    )

    deployment = Deployment(
        project_id=project_id,
        environment="prod",
        deployed_by="release-bot",
        deployed_at=now - timedelta(hours=2),
        metadata_json={"sha": "abc123"},
    )
    db_session.add(deployment)
    db_session.flush()
    db_session.add(
        DeploymentRiskScore(
            deployment_id=deployment.id,
            risk_score=0.71,
            risk_level="high",
            analysis_json={
                "signals": [
                    {
                        "signal_name": "latency_delta",
                        "weighted_value": 0.21,
                    }
                ]
            },
            created_at=now - timedelta(hours=1),
        )
    )
    db_session.add(
        DeploymentSimulation(
            project_id=project_id,
            trace_sample_size=20,
            predicted_failure_rate=0.31,
            predicted_latency_ms=1450,
            risk_level="high",
            analysis_json={"status": "completed"},
            created_at=now - timedelta(minutes=30),
        )
    )

    structured_policy = GuardrailPolicy(
        project_id=project_id,
        policy_type="structured_output",
        config_json={"action": "retry", "require_json": True},
        is_active=True,
    )
    db_session.add(structured_policy)
    db_session.flush()
    for index in range(6):
        db_session.add(
            GuardrailRuntimeEvent(
                trace_id=UUID(f"00000000-0000-4000-8000-{index + 1:012d}"),
                policy_id=structured_policy.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=1100 + index,
                metadata_json={"reason": "invalid_json_output"},
                created_at=now - timedelta(hours=1, minutes=index),
            )
        )
    db_session.commit()

    generated = generate_recommendations(db_session, project_id)
    db_session.commit()

    assert {item.recommendation_type for item in generated} == {
        "simulation_risk",
        "latency_mitigation",
        "guardrail_recommendation",
        "guardrail_pattern",
        "evaluation_recommendation",
        "deployment_regression",
    }

    response = client.get(
        f"/api/v1/projects/{project['id']}/recommendations",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()
    assert {item["type"] for item in payload} == {
        "simulation_risk",
        "latency_mitigation",
        "guardrail_recommendation",
        "guardrail_pattern",
        "evaluation_recommendation",
        "deployment_regression",
    }
    assert payload[2]["evidence_json"]["policy_type"] == "structured_output"


def test_recommendations_endpoint_returns_empty_list_for_project_without_signals(client, db_session):
    session_payload, _, project = _seed_recommendation_project(client, db_session, suffix="empty")

    response = client.get(
        f"/api/v1/projects/{project['id']}/recommendations",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_recommendations_endpoint_is_tenant_safe(client, db_session):
    _, _, project = _seed_recommendation_project(client, db_session, suffix="owner-scope")
    outsider_session, _, _ = _seed_recommendation_project(client, db_session, suffix="outsider-scope")

    response = client.get(
        f"/api/v1/projects/{project['id']}/recommendations",
        headers=auth_headers(outsider_session),
    )

    assert response.status_code == 403


def test_recommendation_worker_and_sweep_enqueue_job(client, db_session, fake_queue, monkeypatch):
    project, anchor = _seed_metric_inputs(client, db_session)
    monkeypatch.setattr("app.services.reliability_recommendations._utc_now", lambda: anchor)

    run_project_reliability_recommendations_for_session(db_session, project_id=project.id)
    assert db_session.query(ReliabilityRecommendation).count() == 0

    result = run_reliability_sweep_for_session(db_session, anchor_time=anchor.isoformat())

    assert result["processed_projects"] >= 1
    assert any(
        getattr(job[0], "__name__", "") == "run_project_reliability_recommendations"
        for job in fake_queue.jobs
    )
