from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.models.automation_rule import AutomationRule
from app.models.incident import Incident
from app.models.organization_alert_target import OrganizationAlertTarget
from app.services.event_stream import DEPLOYMENT_CREATED_EVENT, REGRESSION_DETECTED_EVENT, TRACE_EVALUATED_EVENT
from app.workers.automation_consumer import run_automation_consumer
from app.workers.evaluation_consumer import run_evaluation_consumer
from app.workers.regression_detection_consumer import run_regression_detection_consumer
from .test_api import (
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)
from .test_deployments import _create_deployment, _seed_project_with_versions


def _seed_project(client, db_session, *, slug: str):
    operator = create_operator(db_session, email=f"{slug}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name=f"{slug} Org", slug=slug)
    project = create_project(client, session_payload, organization["id"], name=f"{slug} Project")
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, organization, project, api_key


def test_trace_evaluated_automation_rules_execute_actions(
    client,
    db_session,
    fake_event_stream,
    fake_trace_warehouse,
    fake_queue,
    monkeypatch,
):
    session_payload, organization, project, api_key = _seed_project(
        client,
        db_session,
        slug="automation-trace",
    )
    db_session.add(
        OrganizationAlertTarget(
            organization_id=UUID(organization["id"]),
            channel_type="slack_webhook",
            channel_target="org:automation",
            slack_webhook_url="https://hooks.slack.test/services/automation",
            is_active=True,
        )
    )
    db_session.add_all(
        [
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Open incident on failed trace",
                event_type=TRACE_EVALUATED_EVENT,
                condition_json={"field": "success", "operator": "eq", "value": False},
                action_type="create_incident",
                action_config={"incident_type": "automation_failure", "severity": "high", "title": "Automation failure detected"},
                enabled=True,
            ),
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Webhook on failed trace",
                event_type=TRACE_EVALUATED_EVENT,
                condition_json={"field": "success", "operator": "eq", "value": False},
                action_type="send_webhook",
                action_config={"url": "https://automation.acme.test/hook", "secret": "super-secret"},
                enabled=True,
            ),
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Slack on failed trace",
                event_type=TRACE_EVALUATED_EVENT,
                condition_json={"field": "success", "operator": "eq", "value": False},
                action_type="send_slack_alert",
                action_config={},
                enabled=True,
            ),
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Trigger processor event",
                event_type=TRACE_EVALUATED_EVENT,
                condition_json={"field": "success", "operator": "eq", "value": False},
                action_type="trigger_processor",
                action_config={"event_type": "processor_triggered"},
                enabled=True,
            ),
        ]
    )
    db_session.commit()

    calls: list[tuple[str, dict]] = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append((str(url), {"json": json, "headers": headers, "timeout": timeout}))
        return type("Resp", (), {"raise_for_status": staticmethod(lambda: None)})()

    monkeypatch.setattr("app.services.automation_rules.httpx.post", fake_post)

    trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T14:00:00Z",
            "request_id": "automation-fail-1",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "output_text": "not-json",
            "success": False,
            "latency_ms": 900,
            "metadata_json": {"expected_output_format": "json"},
        },
    )

    assert run_evaluation_consumer(max_events=1) == 1
    assert run_automation_consumer(max_events=20) >= 1

    incident = db_session.scalar(
        db_session.query(Incident).filter(Incident.project_id == UUID(project["id"])).statement
    )
    assert incident is not None
    assert incident.incident_type == "automation_failure"
    assert incident.title == "Automation failure detected"
    assert len(calls) == 2
    assert calls[0][0] == "https://automation.acme.test/hook"
    assert calls[1][0] == "https://hooks.slack.test/services/automation"

    messages = list(fake_event_stream.consume("trace_events"))
    assert any(message.event_type == "processor_triggered" for message in messages)
    automation_events = [message for message in messages if message.event_type == "automation_triggered"]
    assert len(automation_events) == 4
    assert any(message.payload.get("trace_id") == trace["trace_id"] for message in messages if message.event_type == TRACE_EVALUATED_EVENT)


def test_deployment_and_regression_events_can_drive_automation(
    client,
    db_session,
    fake_event_stream,
    fake_trace_warehouse,
    fake_queue,
    monkeypatch,
):
    session_payload, _, project, api_key, prompt_version, model_version = _seed_project_with_versions(client, db_session)
    monkeypatch.setattr("app.services.automation_rules.httpx.post", lambda *args, **kwargs: type("Resp", (), {"raise_for_status": staticmethod(lambda: None)})())
    db_session.add_all(
        [
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Notify on deployment",
                event_type=DEPLOYMENT_CREATED_EVENT,
                condition_json={"field": "environment", "operator": "eq", "value": "prod"},
                action_type="send_webhook",
                action_config={"url": "https://automation.acme.test/deploy"},
                enabled=True,
            ),
            AutomationRule(
                project_id=UUID(project["id"]),
                name="Incident on success regression",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="create_incident",
                action_config={"incident_type": "automation_regression", "severity": "medium", "title": "Regression automation incident"},
                enabled=True,
            ),
        ]
    )
    db_session.commit()

    created = _create_deployment(
        client,
        session_payload,
        project["id"],
        prompt_version_id=prompt_version["id"],
        model_version_id=model_version["id"],
        deployed_at=datetime(2026, 3, 10, 10, 0, tzinfo=timezone.utc),
    )
    deployment_messages = list(fake_event_stream.consume("trace_events"))
    assert any(message.event_type == DEPLOYMENT_CREATED_EVENT and message.payload["deployment_id"] == created["id"] for message in deployment_messages)

    baseline_time = datetime(2026, 3, 10, 11, 0, tzinfo=timezone.utc)
    current_time = baseline_time + timedelta(hours=1)
    for index in range(10):
        ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_time + timedelta(minutes=index)).isoformat(),
                "request_id": f"automation-baseline-{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}",
                "success": True,
                "latency_ms": 220,
                "metadata_json": {"expected_output_format": "json"},
            },
        )
    for index in range(10):
        ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_time + timedelta(minutes=index)).isoformat(),
                "request_id": f"automation-current-{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "output_text": "not-json",
                "success": False,
                "latency_ms": 1200,
                "metadata_json": {"expected_output_format": "json"},
            },
        )

    assert run_evaluation_consumer(max_events=20) == 20
    assert run_regression_detection_consumer(max_events=20) == 20
    assert run_automation_consumer(max_events=200) >= 1

    messages = list(fake_event_stream.consume("trace_events"))
    assert any(message.event_type == REGRESSION_DETECTED_EVENT for message in messages)
    incident = db_session.scalar(
        db_session.query(Incident)
        .filter(Incident.project_id == UUID(project["id"]), Incident.incident_type == "automation_regression")
        .statement
    )
    assert incident is not None
