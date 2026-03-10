from datetime import datetime, timezone
from uuid import UUID

from app.models.automation_rule import AutomationRule
from app.models.deployment import Deployment
from app.models.deployment_rollback import DeploymentRollback
from app.models.environment import Environment
from app.models.external_processor import ExternalProcessor
from app.models.guardrail_policy import GuardrailPolicy
from app.models.reliability_action_log import ReliabilityActionLog
from app.models.trace_ingestion_policy import TraceIngestionPolicy
from app.services.automation_rules import evaluate_automation_rules
from app.services.event_stream import EventMessage, REGRESSION_DETECTED_EVENT
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _seed_project(client, db_session, *, slug: str):
    operator = create_operator(db_session, email=f"{slug}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name=f"{slug} Org", slug=slug)
    project = create_project(client, session_payload, organization["id"], name=f"{slug} Project")
    environment = db_session.scalar(
        db_session.query(Environment).filter(Environment.project_id == UUID(project["id"])).statement
    )
    assert environment is not None
    return session_payload, organization, project, environment


def _regression_event(*, project_id: str, deployment_id: str | None = None) -> EventMessage:
    return EventMessage(
        topic="trace_events",
        key=project_id,
        partition=0,
        offset=0,
        event_type=REGRESSION_DETECTED_EVENT,
        payload={
            "project_id": project_id,
            "deployment_id": deployment_id,
            "metric_name": "success_rate",
            "detected_at": "2026-03-10T15:00:00Z",
        },
        published_at=datetime(2026, 3, 10, 15, 0, tzinfo=timezone.utc),
    )


def test_reliability_actions_execute_state_changes(client, db_session):
    _, _, project, environment = _seed_project(client, db_session, slug="actions-live")
    project_id = UUID(project["id"])
    deployment = Deployment(
        project_id=project_id,
        environment_id=environment.id,
        environment=environment.name,
        deployed_by="ops@acme.test",
        deployed_at=datetime(2026, 3, 10, 14, 0, tzinfo=timezone.utc),
    )
    processor = ExternalProcessor(
        project_id=project_id,
        name="Regression Hook",
        event_type=REGRESSION_DETECTED_EVENT,
        endpoint_url="https://processors.acme.test/regressions",
        secret="top-secret",
        enabled=True,
    )
    ingestion_policy = TraceIngestionPolicy(
        project_id=project_id,
        environment_id=None,
        sampling_success_rate=0.25,
        sampling_error_rate=0.5,
    )
    db_session.add_all([deployment, processor, ingestion_policy])
    db_session.flush()
    db_session.add_all(
        [
            AutomationRule(
                project_id=project_id,
                name="Rollback on regression",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="rollback_deployment",
                action_config={"deployment_id": str(deployment.id)},
                enabled=True,
                dry_run=False,
                cooldown_minutes=0,
                max_actions_per_hour=3,
            ),
            AutomationRule(
                project_id=project_id,
                name="Enable guardrail on regression",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="enable_guardrail",
                action_config={"policy_type": "hallucination"},
                enabled=True,
                dry_run=False,
                cooldown_minutes=0,
                max_actions_per_hour=3,
            ),
            AutomationRule(
                project_id=project_id,
                name="Increase sampling on regression",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="increase_sampling",
                action_config={},
                enabled=True,
                dry_run=False,
                cooldown_minutes=0,
                max_actions_per_hour=3,
            ),
            AutomationRule(
                project_id=project_id,
                name="Disable processor on regression",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="disable_processor",
                action_config={"processor_id": str(processor.id)},
                enabled=True,
                dry_run=False,
                cooldown_minutes=0,
                max_actions_per_hour=3,
            ),
        ]
    )
    db_session.commit()

    triggered = evaluate_automation_rules(
        db_session,
        _regression_event(project_id=project["id"], deployment_id=str(deployment.id)),
    )

    assert len(triggered) == 4
    assert db_session.scalar(
        db_session.query(DeploymentRollback).filter(DeploymentRollback.deployment_id == deployment.id).statement
    )
    guardrail = db_session.scalar(
        db_session.query(GuardrailPolicy)
        .filter(GuardrailPolicy.project_id == project_id, GuardrailPolicy.policy_type == "hallucination")
        .statement
    )
    assert guardrail is not None
    assert guardrail.is_active is True
    db_session.refresh(ingestion_policy)
    db_session.refresh(processor)
    assert ingestion_policy.sampling_success_rate == 0.5
    assert ingestion_policy.sampling_error_rate == 0.75
    assert processor.enabled is False
    logs = db_session.query(ReliabilityActionLog).filter(ReliabilityActionLog.project_id == project_id).all()
    assert len(logs) == 4
    assert {log.status for log in logs} == {"success"}


def test_reliability_actions_dry_run_only_logs(client, db_session):
    _, _, project, environment = _seed_project(client, db_session, slug="actions-dry-run")
    project_id = UUID(project["id"])
    deployment = Deployment(
        project_id=project_id,
        environment_id=environment.id,
        environment=environment.name,
        deployed_by="ops@acme.test",
        deployed_at=datetime(2026, 3, 10, 14, 0, tzinfo=timezone.utc),
    )
    processor = ExternalProcessor(
        project_id=project_id,
        name="Regression Hook",
        event_type=REGRESSION_DETECTED_EVENT,
        endpoint_url="https://processors.acme.test/regressions",
        secret="top-secret",
        enabled=True,
    )
    db_session.add_all([deployment, processor])
    db_session.flush()
    db_session.add_all(
        [
            AutomationRule(
                project_id=project_id,
                name="Dry rollback",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="rollback_deployment",
                action_config={"deployment_id": str(deployment.id)},
                enabled=True,
                dry_run=True,
                cooldown_minutes=0,
                max_actions_per_hour=2,
            ),
            AutomationRule(
                project_id=project_id,
                name="Dry disable processor",
                event_type=REGRESSION_DETECTED_EVENT,
                condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
                action_type="disable_processor",
                action_config={"processor_id": str(processor.id)},
                enabled=True,
                dry_run=True,
                cooldown_minutes=0,
                max_actions_per_hour=2,
            ),
        ]
    )
    db_session.commit()

    evaluate_automation_rules(
        db_session,
        _regression_event(project_id=project["id"], deployment_id=str(deployment.id)),
    )

    assert db_session.query(DeploymentRollback).count() == 0
    db_session.refresh(processor)
    assert processor.enabled is True
    logs = db_session.query(ReliabilityActionLog).filter(ReliabilityActionLog.project_id == project_id).all()
    assert {log.status for log in logs} == {"dry_run"}


def test_reliability_actions_respect_cooldown(client, db_session):
    _, _, project, environment = _seed_project(client, db_session, slug="actions-cooldown")
    project_id = UUID(project["id"])
    deployment = Deployment(
        project_id=project_id,
        environment_id=environment.id,
        environment=environment.name,
        deployed_by="ops@acme.test",
        deployed_at=datetime(2026, 3, 10, 14, 0, tzinfo=timezone.utc),
    )
    rule = AutomationRule(
        project_id=project_id,
        name="Rollback with cooldown",
        event_type=REGRESSION_DETECTED_EVENT,
        condition_json={"field": "metric_name", "operator": "eq", "value": "success_rate"},
        action_type="rollback_deployment",
        action_config={"deployment_id": str(deployment.id)},
        enabled=True,
        dry_run=False,
        cooldown_minutes=120,
        max_actions_per_hour=5,
    )
    db_session.add(deployment)
    db_session.flush()
    rule.action_config = {"deployment_id": str(deployment.id)}
    db_session.add(rule)
    db_session.commit()

    event = _regression_event(project_id=project["id"], deployment_id=str(deployment.id))
    evaluate_automation_rules(db_session, event)
    evaluate_automation_rules(db_session, event)

    logs = (
        db_session.query(ReliabilityActionLog)
        .filter(ReliabilityActionLog.project_id == project_id)
        .order_by(ReliabilityActionLog.created_at.asc())
        .all()
    )
    assert [log.status for log in logs] == ["success", "skipped_cooldown"]
    assert db_session.query(DeploymentRollback).count() == 1


def test_automation_actions_endpoint_is_tenant_safe(client, db_session):
    owner_one = create_operator(db_session, email="owner-actions@acme.test")
    owner_two = create_operator(db_session, email="owner-actions@beta.test")
    session_one = sign_in(client, email=owner_one.email)
    session_two = sign_in(client, email=owner_two.email)
    organization = create_organization(client, session_one, name="Actions Org", slug="actions-org")
    project = create_project(client, session_one, organization["id"], name="Actions Project")

    db_session.add(
        ReliabilityActionLog(
            project_id=UUID(project["id"]),
            rule_id=None,
            action_type="enable_guardrail",
            target="guardrail:structured_output",
            status="success",
            detail_json={"policy_id": "none"},
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/automation-actions",
        headers=auth_headers(session_one),
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["action_type"] == "enable_guardrail"

    blocked = client.get(
        f"/api/v1/projects/{project['id']}/automation-actions",
        headers=auth_headers(session_two),
    )
    assert blocked.status_code == 403
