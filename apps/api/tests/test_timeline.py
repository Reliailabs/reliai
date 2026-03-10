from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.models.deployment import Deployment
from app.models.guardrail_event import GuardrailEvent
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
