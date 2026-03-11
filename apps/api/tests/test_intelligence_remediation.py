from datetime import datetime, timezone
from uuid import UUID

from app.models.incident import Incident
from app.processors.reliability_graph_processor import process_reliability_graph_event

from .test_api import auth_headers
from .test_reliability_graph import _seed_graph_state


def test_deployment_detail_includes_graph_patterns_and_guardrails(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
):
    session_payload, project, prompt_version, model_version = _seed_graph_state(
        client,
        db_session,
        fake_queue,
        fake_trace_warehouse,
    )

    created = client.post(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(session_payload),
        json={
            "environment": "production",
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "deployed_by": "remediation-test",
            "deployed_at": datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc).isoformat(),
        },
    )
    assert created.status_code == 201

    detail = client.get(
        f"/api/v1/deployments/{created.json()['id']}",
        headers=auth_headers(session_payload),
    )

    assert detail.status_code == 200
    payload = detail.json()
    assert payload["intelligence"] is not None
    assert "graph_risk_patterns" in payload["intelligence"]
    assert "recommended_guardrails" in payload["intelligence"]


def test_incident_command_center_includes_mitigation_suggestions(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
):
    session_payload, project, _, _ = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)
    incident = Incident(
        organization_id=UUID(project["organization_id"]),
        project_id=UUID(project["id"]),
        environment_id=UUID(project["environments"][0]["id"]),
        incident_type="graph_command_center",
        severity="high",
        title="Command center graph incident",
        status="open",
        fingerprint="command-center-graph-incident",
        summary_json={"metric_name": "latency_ms", "retrieval_chunks": 18},
        started_at=datetime(2026, 3, 11, 13, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 11, 13, 0, tzinfo=timezone.utc),
    )
    db_session.add(incident)
    db_session.commit()
    process_reliability_graph_event(
        {
            "incident_id": str(incident.id),
            "project_id": str(incident.project_id),
            "organization_id": str(incident.organization_id),
            "environment_id": str(incident.environment_id),
            "incident_type": incident.incident_type,
            "severity": incident.severity,
            "started_at": incident.started_at.isoformat(),
            "metadata": {},
        },
        event_type="incident_created",
    )

    response = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert "graph_related_patterns" in payload
    assert "recommended_mitigations" in payload
    assert payload["recommended_mitigations"]
