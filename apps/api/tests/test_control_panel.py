from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.deployment import Deployment
from app.models.deployment_risk_score import DeploymentRiskScore
from app.models.deployment_simulation import DeploymentSimulation
from app.models.global_model_reliability import GlobalModelReliability
from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.model_version import ModelVersion
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _seed_control_panel_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"control-panel-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Control Panel Org {suffix}",
        slug=f"control-panel-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Control Panel Project {suffix}",
    )
    return session_payload, organization, project


def test_control_panel_aggregates_existing_signals(client, db_session, monkeypatch):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.reliability_control_panel._utc_now", lambda: now)
    session_payload, organization, project = _seed_control_panel_project(
        client,
        db_session,
        suffix="aggregate",
    )

    model_version = ModelVersion(
        project_id=UUID(project["id"]),
        provider="openai",
        model_name="gpt-4.1",
        model_version="2026-03",
        model_family="gpt-4.1",
        model_revision="2026-03",
        route_key="primary",
        label="Primary route",
        identity_key="openai:gpt-4.1:2026-03",
    )
    db_session.add(model_version)
    db_session.flush()

    deployment = Deployment(
        project_id=UUID(project["id"]),
        model_version_id=model_version.id,
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
            risk_score=0.62,
            risk_level="medium",
            analysis_json={"signals": [{"name": "structured_output_validity"}]},
            created_at=now - timedelta(hours=1, minutes=30),
        )
    )
    db_session.add(
        DeploymentSimulation(
            project_id=UUID(project["id"]),
            model_version_id=model_version.id,
            trace_sample_size=20,
            predicted_failure_rate=0.31,
            predicted_latency_ms=1480,
            risk_level="high",
            analysis_json={"status": "completed"},
            created_at=now - timedelta(hours=1),
        )
    )

    guardrail_policy = GuardrailPolicy(
        project_id=UUID(project["id"]),
        policy_type="structured_output",
        config_json={"action": "retry", "require_json": True},
        is_active=True,
    )
    db_session.add(guardrail_policy)
    db_session.flush()
    db_session.add_all(
        [
            GuardrailRuntimeEvent(
                trace_id=UUID("11111111-1111-4111-8111-111111111111"),
                policy_id=guardrail_policy.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=1220,
                metadata_json={"reason": "invalid_json_output"},
                created_at=now - timedelta(hours=3),
            ),
            GuardrailRuntimeEvent(
                trace_id=UUID("22222222-2222-4222-8222-222222222222"),
                policy_id=guardrail_policy.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=1110,
                metadata_json={"reason": "invalid_json_output"},
                created_at=now - timedelta(hours=2, minutes=20),
            ),
        ]
    )

    db_session.add_all(
        [
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                deployment_id=deployment.id,
                incident_type="structured_output_regression",
                severity="high",
                title="Structured output validity dropped after rollout",
                status="open",
                fingerprint="aggregate-incident-1",
                summary_json={"metric_name": "structured_output_validity_rate"},
                started_at=now - timedelta(hours=5),
                updated_at=now - timedelta(hours=4, minutes=40),
            ),
            Incident(
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                incident_type="latency_spike",
                severity="medium",
                title="Latency p95 spiked in prod",
                status="resolved",
                fingerprint="aggregate-incident-2",
                summary_json={"metric_name": "latency_ms"},
                started_at=now - timedelta(hours=8),
                updated_at=now - timedelta(hours=6),
                resolved_at=now - timedelta(hours=6),
            ),
        ]
    )

    db_session.add_all(
        [
            GlobalModelReliability(
                provider="openai",
                model_name="gpt-4.1",
                metric_name="success_rate",
                metric_value=0.93,
                sample_size=200,
                updated_at=now - timedelta(minutes=30),
            ),
            GlobalModelReliability(
                provider="openai",
                model_name="gpt-4.1",
                metric_name="average_latency_ms",
                metric_value=820.0,
                sample_size=200,
                updated_at=now - timedelta(minutes=30),
            ),
            GlobalModelReliability(
                provider="openai",
                model_name="gpt-4.1",
                metric_name="structured_output_validity_rate",
                metric_value=0.89,
                sample_size=160,
                updated_at=now - timedelta(minutes=30),
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/control-panel",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["deployment_risk"]["latest_deployment_id"] == str(deployment.id)
    assert payload["deployment_risk"]["risk_score"] == 0.62
    assert payload["deployment_risk"]["risk_level"] == "medium"
    assert payload["simulation"]["predicted_failure_rate"] == 0.31
    assert payload["simulation"]["predicted_latency"] == 1480.0
    assert payload["simulation"]["risk_level"] == "high"
    assert payload["guardrails"]["trigger_rate_last_24h"] == 2
    assert payload["guardrails"]["top_triggered_policy"] == "structured_output"
    assert payload["model_reliability"]["current_model"] == "gpt-4.1"
    assert payload["model_reliability"]["success_rate"] == 0.93
    assert payload["model_reliability"]["average_latency"] == 820.0
    assert payload["model_reliability"]["structured_output_validity"] == 0.89
    assert payload["incidents"]["incident_rate_last_24h"] == 2
    assert len(payload["incidents"]["recent_incidents"]) == 2


def test_control_panel_handles_missing_simulation_and_deployment(client, db_session, monkeypatch):
    monkeypatch.setattr(
        "app.services.reliability_control_panel._utc_now",
        lambda: datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
    )
    session_payload, _, project = _seed_control_panel_project(client, db_session, suffix="empty")

    response = client.get(
        f"/api/v1/projects/{project['id']}/control-panel",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["deployment_risk"] == {
        "latest_deployment_id": None,
        "deployed_at": None,
        "risk_score": None,
        "risk_level": None,
    }
    assert payload["simulation"] == {
        "latest_simulation_id": None,
        "predicted_failure_rate": None,
        "predicted_latency": None,
        "risk_level": None,
        "created_at": None,
    }
    assert payload["incidents"] == {"recent_incidents": [], "incident_rate_last_24h": 0}
    assert payload["guardrails"] == {"trigger_rate_last_24h": 0, "top_triggered_policy": None}
    assert payload["model_reliability"] == {
        "current_model": None,
        "success_rate": None,
        "average_latency": None,
        "structured_output_validity": None,
    }


def test_control_panel_is_tenant_safe(client, db_session):
    _, _, project = _seed_control_panel_project(client, db_session, suffix="owner-scope")
    outsider_session, _, _ = _seed_control_panel_project(client, db_session, suffix="outsider-scope")

    response = client.get(
        f"/api/v1/projects/{project['id']}/control-panel",
        headers=auth_headers(outsider_session),
    )

    assert response.status_code == 403
