from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.deployment_simulation import DeploymentSimulation
from app.models.environment import Environment
from app.models.guardrail_event import GuardrailEvent
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.guardrail_policy import GuardrailPolicy
from app.models.incident import Incident
from app.models.regression_snapshot import RegressionSnapshot
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_project_timeline_merges_sources_and_sorts(client, db_session, fake_queue):
    owner = create_operator(db_session, email="timeline-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Timeline Org", slug="timeline-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    trace_response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T11:00:00Z",
            "request_id": "guardrail-trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "latency_ms": 900,
            "prompt_tokens": 20,
            "completion_tokens": 8,
        },
    )
    trace_id = UUID(trace_response["trace_id"])

    deployment = Deployment(
        project_id=UUID(project["id"]),
        environment="prod",
        deployed_by="ci-bot",
        deployed_at=datetime(2026, 3, 9, 9, 0, tzinfo=timezone.utc),
        metadata_json={"deployment_strategy": "canary"},
    )
    policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        policy_type="latency_retry",
        config_json={"action": "retry", "max_latency_ms": 400},
        is_active=True,
    )
    regression = RegressionSnapshot(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        metric_name="p95_latency_ms",
        current_value="1200.000000",
        baseline_value="200.000000",
        delta_absolute="1000.000000",
        delta_percent="5.000000",
        scope_type="project",
        scope_id=project["id"],
        window_minutes=60,
        detected_at=datetime(2026, 3, 9, 10, 0, tzinfo=timezone.utc),
        metadata_json={},
    )
    incident = Incident(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        incident_type="p95_latency_spike",
        severity="high",
        title="P95 latency spiked",
        status="open",
        fingerprint=f"timeline:{uuid4()}",
        summary_json={"metric_name": "p95_latency_ms"},
        started_at=datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([deployment, policy, regression, incident])
    db_session.flush()
    db_session.add(
        GuardrailEvent(
            trace_id=trace_id,
            policy_id=policy.id,
            action_taken="retry",
            metadata_json={"reason": "latency_budget_exceeded"},
            created_at=datetime(2026, 3, 9, 11, 30, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/timeline",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["event_type"] for item in items[:4]] == [
        "incident",
        "guardrail",
        "regression",
        "deployment",
    ]
    assert items[0]["metadata"]["path"].startswith("/incidents/")
    assert items[1]["metadata"]["path"].startswith("/traces/")
    assert items[2]["metadata"]["path"].startswith("/regressions/")
    assert items[3]["metadata"]["path"].startswith("/deployments/")


def test_project_timeline_is_tenant_safe(client, db_session, fake_queue):
    owner = create_operator(db_session, email="timeline-safe-owner@acme.test")
    outsider = create_operator(db_session, email="timeline-safe-outsider@beta.test")
    owner_session = sign_in(client, email=owner.email)
    outsider_session = sign_in(client, email=outsider.email)
    organization = create_organization(client, owner_session, name="Safe Org", slug="safe-org")
    project = create_project(client, owner_session, organization["id"])

    response = client.get(
        f"/api/v1/projects/{project['id']}/timeline",
        headers=auth_headers(outsider_session),
    )

    assert response.status_code == 403


def test_project_timeline_filters_environment_scoped_signals(client, db_session, fake_queue):
    owner = create_operator(db_session, email="timeline-env-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Timeline Env Org", slug="timeline-env-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    staging_response = client.post(
        f"/api/v1/projects/{project['id']}/environments",
        headers=auth_headers(session_payload),
        json={"name": "staging", "type": "staging"},
    )
    assert staging_response.status_code == 201

    environments = {
        environment.name: environment
        for environment in db_session.scalars(
            select(Environment).where(Environment.project_id == UUID(project["id"]))
        ).all()
    }
    production_env = environments["production"]
    staging_env = environments["staging"]

    production_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T11:00:00Z",
            "request_id": "prod-guardrail",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "latency_ms": 420,
            "prompt_tokens": 10,
            "completion_tokens": 5,
        },
    )

    production_deployment = Deployment(
        project_id=UUID(project["id"]),
        environment_id=production_env.id,
        environment="production",
        deployed_by="prod-bot",
        deployed_at=datetime(2026, 3, 9, 10, 0, tzinfo=timezone.utc),
        metadata_json=None,
    )
    staging_deployment = Deployment(
        project_id=UUID(project["id"]),
        environment_id=staging_env.id,
        environment="staging",
        deployed_by="stage-bot",
        deployed_at=datetime(2026, 3, 9, 10, 5, tzinfo=timezone.utc),
        metadata_json=None,
    )
    production_policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        environment_id=production_env.id,
        policy_type="structured_output",
        config_json={"action": "retry"},
        is_active=True,
    )
    staging_policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        environment_id=staging_env.id,
        policy_type="latency_retry",
        config_json={"action": "retry"},
        is_active=True,
    )
    production_incident = Incident(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment_id=production_env.id,
        incident_type="success_rate_drop",
        severity="high",
        title="Production incident",
        status="open",
        fingerprint=f"timeline-prod:{uuid4()}",
        summary_json={"metric_name": "success_rate"},
        started_at=datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc),
    )
    staging_incident = Incident(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment_id=staging_env.id,
        incident_type="success_rate_drop",
        severity="medium",
        title="Staging incident",
        status="open",
        fingerprint=f"timeline-stage:{uuid4()}",
        summary_json={"metric_name": "success_rate"},
        started_at=datetime(2026, 3, 9, 12, 5, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 9, 12, 5, tzinfo=timezone.utc),
    )
    db_session.add_all(
        [
            production_deployment,
            staging_deployment,
            production_policy,
            staging_policy,
            production_incident,
            staging_incident,
        ]
    )
    db_session.flush()
    db_session.add_all(
        [
            GuardrailEvent(
                trace_id=UUID(production_trace["trace_id"]),
                policy_id=production_policy.id,
                action_taken="retry",
                metadata_json={"reason": "schema"},
                created_at=datetime(2026, 3, 9, 11, 30, tzinfo=timezone.utc),
            ),
            GuardrailRuntimeEvent(
                trace_id=UUID(production_trace["trace_id"]),
                policy_id=production_policy.id,
                environment_id=production_env.id,
                action_taken="retry",
                provider_model="gpt-4.1-mini",
                latency_ms=450,
                metadata_json={"reason": "schema"},
                created_at=datetime(2026, 3, 9, 11, 35, tzinfo=timezone.utc),
            ),
            GuardrailRuntimeEvent(
                trace_id=UUID(production_trace["trace_id"]),
                policy_id=staging_policy.id,
                environment_id=staging_env.id,
                action_taken="retry",
                provider_model="gpt-4.1-mini",
                latency_ms=470,
                metadata_json={"reason": "latency"},
                created_at=datetime(2026, 3, 9, 11, 40, tzinfo=timezone.utc),
            ),
            DeploymentRiskScore(
                deployment_id=production_deployment.id,
                environment_id=production_env.id,
                risk_score="0.22",
                risk_level="low",
                analysis_json={"signals": []},
                created_at=datetime(2026, 3, 9, 10, 10, tzinfo=timezone.utc),
            ),
            DeploymentRiskScore(
                deployment_id=staging_deployment.id,
                environment_id=staging_env.id,
                risk_score="0.81",
                risk_level="high",
                analysis_json={"signals": []},
                created_at=datetime(2026, 3, 9, 10, 15, tzinfo=timezone.utc),
            ),
            DeploymentSimulation(
                project_id=UUID(project["id"]),
                environment_id=production_env.id,
                prompt_version_id=None,
                model_version_id=None,
                trace_sample_size=20,
                predicted_failure_rate="0.08",
                predicted_latency_ms=300,
                risk_level="low",
                analysis_json={},
                created_at=datetime(2026, 3, 9, 10, 20, tzinfo=timezone.utc),
            ),
            DeploymentSimulation(
                project_id=UUID(project["id"]),
                environment_id=staging_env.id,
                prompt_version_id=None,
                model_version_id=None,
                trace_sample_size=20,
                predicted_failure_rate="0.22",
                predicted_latency_ms=600,
                risk_level="high",
                analysis_json={},
                created_at=datetime(2026, 3, 9, 10, 25, tzinfo=timezone.utc),
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/timeline?environment=production",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    items = response.json()["items"]
    titles = [item["title"] for item in items]
    summaries = [item["summary"] for item in items]

    assert "Production incident" in titles
    assert "Staging incident" not in titles
    assert any(summary == "production · by prod-bot" for summary in summaries)
    assert "staging · by stage-bot" not in summaries
    assert any(item["event_type"] == "guardrail_runtime_enforced" for item in items)
    assert not any(item["title"] == "Runtime guardrail retry" and "latency" in item["summary"] for item in items)
