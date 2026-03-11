from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.automation_rule import AutomationRule
from app.models.incident import Incident
from app.models.reliability_action_log import ReliabilityActionLog
from app.processors.reliability_graph_processor import process_reliability_graph_event
from app.services.automation_rules import (
    ACTION_RECOMMEND_GUARDRAIL,
    RULE_SOURCE_GRAPH_INTELLIGENCE,
    run_graph_intelligence_automation,
)
from app.services.deployment_risk_engine import calculate_deployment_risk

from .test_api import auth_headers
from .test_reliability_graph import _seed_graph_state


def test_control_panel_includes_graph_signals(client, db_session, fake_queue, fake_trace_warehouse):
    session_payload, project, _, _ = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)

    response = client.get(
        f"/api/v1/projects/{project['id']}/control-panel",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert "graph_high_risk_patterns" in payload
    assert "recommended_guardrails" in payload
    assert "model_failure_signals" in payload
    assert payload["graph_high_risk_patterns"]


def test_incident_investigation_includes_possible_root_causes(
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
        incident_type="graph_investigation",
        severity="high",
        title="Graph-backed incident",
        status="open",
        fingerprint="graph-backed-incident",
        summary_json={},
        started_at=datetime(2026, 3, 11, 9, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 11, 9, 0, tzinfo=timezone.utc),
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
        f"/api/v1/incidents/{incident.id}/investigation",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    assert "possible_root_causes" in response.json()


def test_deployment_risk_stores_graph_explanations(client, db_session, fake_queue, fake_trace_warehouse):
    session_payload, project, prompt_version, model_version = _seed_graph_state(
        client,
        db_session,
        fake_queue,
        fake_trace_warehouse,
    )

    response = client.post(
        f"/api/v1/projects/{project['id']}/deployments",
        headers=auth_headers(session_payload),
        json={
            "environment": "production",
            "prompt_version_id": prompt_version["id"],
            "model_version_id": model_version["id"],
            "deployed_by": "integration-test",
            "deployed_at": datetime(2026, 3, 11, 10, 0, tzinfo=timezone.utc).isoformat(),
        },
    )
    assert response.status_code == 201

    risk = calculate_deployment_risk(db_session, deployment_id=UUID(response.json()["id"]))
    assert "deployment_risk_explanations" in risk.analysis_json
    assert isinstance(risk.analysis_json["deployment_risk_explanations"], list)


def test_graph_intelligence_rules_log_actions(client, db_session, fake_queue, fake_trace_warehouse, monkeypatch):
    _, project, _, _ = _seed_graph_state(client, db_session, fake_queue, fake_trace_warehouse)
    monkeypatch.setattr(
        "app.services.automation_rules.get_graph_guardrail_recommendations",
        lambda db, organization_ids, project_id: [
            {
                "policy_type": "latency_retry",
                "recommended_action": "retry",
                "title": "Add latency retry guardrail coverage",
                "confidence": 0.92,
                "pattern": "gpt-4.1 + latency_spike",
            }
        ],
    )
    rule = AutomationRule(
        project_id=UUID(project["id"]),
        name="Graph recommendation rule",
        event_type=RULE_SOURCE_GRAPH_INTELLIGENCE,
        condition_json={"field": "graph_pattern_confidence", "operator": "gte", "value": 0.2},
        action_type=ACTION_RECOMMEND_GUARDRAIL,
        action_config={},
        rule_source=RULE_SOURCE_GRAPH_INTELLIGENCE,
        enabled=True,
        cooldown_minutes=0,
        dry_run=False,
        max_actions_per_hour=10,
    )
    db_session.add(rule)
    db_session.commit()

    triggered = run_graph_intelligence_automation(db_session, project_id=UUID(project["id"]))
    log = db_session.scalar(
        select(ReliabilityActionLog)
        .where(
            ReliabilityActionLog.project_id == UUID(project["id"]),
            ReliabilityActionLog.action_type == ACTION_RECOMMEND_GUARDRAIL,
        )
        .order_by(ReliabilityActionLog.created_at.desc(), ReliabilityActionLog.id.desc())
    )

    assert triggered
    assert log is not None
    assert log.detail_json["rule_source"] == RULE_SOURCE_GRAPH_INTELLIGENCE
