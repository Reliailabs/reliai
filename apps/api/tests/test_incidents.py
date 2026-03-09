import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import httpx
from sqlalchemy import desc, select

from app.core.settings import get_settings
from app.models.evaluation_rollup import EvaluationRollup
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.organization_alert_target import OrganizationAlertTarget
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.services.alerts import (
    ALERT_STATUS_FAILED,
    ALERT_STATUS_PENDING,
    ALERT_STATUS_SENT,
    ALERT_STATUS_SUPPRESSED,
    create_alert_deliveries_for_open_incidents,
    deliver_alert_delivery,
)
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.workers.evaluations import enqueue_alert_delivery_job
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _set_env(name: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value
    get_settings.cache_clear()


def _run_signal_pipeline(db_session, trace_id: UUID) -> None:
    evaluation = run_structured_output_validity_evaluation(db_session, trace_id)
    assert evaluation is not None
    trace = db_session.get(Trace, trace_id)
    assert trace is not None
    project = db_session.get(Project, trace.project_id)
    assert project is not None
    for scope in build_scopes(trace):
        result = compute_regressions_for_scope(db_session, scope=scope, anchor_time=trace.timestamp)
        sync_incidents_for_scope(
            db_session,
            scope=scope,
            project=project,
            regressions=result.snapshots,
            detected_at=trace.timestamp,
        )
    db_session.commit()


def _seed_operator_project(client, db_session, *, org_slug: str):
    operator = create_operator(db_session, email=f"{org_slug}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug=org_slug)
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, organization, project, api_key


def _seed_success_rate_regression(client, db_session):
    session_payload, organization, project, api_key = _seed_operator_project(
        client, db_session, org_slug="acme-incidents"
    )
    baseline_start = datetime(2026, 3, 9, 9, 0, 30, tzinfo=timezone.utc)
    current_start = datetime(2026, 3, 9, 10, 0, 30, tzinfo=timezone.utc)

    for index in range(10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"baseline_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v2",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 220,
                "total_cost_usd": "0.010000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    latest_trace_id = None
    for index in range(10):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_start + timedelta(minutes=index * 5)).isoformat(),
                "request_id": f"current_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v2",
                "output_text": "{\"ok\":false}" if index == 0 else "not-json",
                "success": index == 0,
                "error_type": None if index == 0 else "provider_error",
                "latency_ms": 300 if index == 0 else 1200,
                "total_cost_usd": "0.015000" if index == 0 else "0.040000",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        latest_trace_id = UUID(response["trace_id"])
        _run_signal_pipeline(db_session, latest_trace_id)

    assert latest_trace_id is not None
    return session_payload, organization, project, latest_trace_id


def _list_open_incidents(db_session, project_id: str) -> list[Incident]:
    return db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project_id),
            Incident.status == "open",
        )
    ).all()


def _incident_for_type(db_session, project_id: str, incident_type: str) -> Incident:
    incident = db_session.scalar(
        select(Incident).where(
            Incident.project_id == UUID(project_id),
            Incident.incident_type == incident_type,
        )
    )
    assert incident is not None
    return incident


def test_rollups_persist_for_project_and_prompt_version_scopes(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)

    project_rollup = db_session.scalar(
        select(EvaluationRollup)
        .where(
            EvaluationRollup.project_id == UUID(project["id"]),
            EvaluationRollup.scope_type == "project",
            EvaluationRollup.metric_name == "success_rate",
        )
        .order_by(desc(EvaluationRollup.window_end))
    )
    prompt_rollup = db_session.scalar(
        select(EvaluationRollup)
        .where(
            EvaluationRollup.project_id == UUID(project["id"]),
            EvaluationRollup.scope_type == "prompt_version",
            EvaluationRollup.scope_id == "v2",
            EvaluationRollup.metric_name == "structured_output_validity_pass_rate",
        )
        .order_by(desc(EvaluationRollup.window_end))
    )

    assert project_rollup is not None
    assert project_rollup.window_minutes == 60
    assert project_rollup.metric_value == Decimal("0.100000")
    assert prompt_rollup is not None
    assert prompt_rollup.metric_value == Decimal("0.100000")


def test_regression_snapshots_capture_current_and_baseline(client, db_session, fake_queue):
    _, _, project, _ = _seed_success_rate_regression(client, db_session)

    snapshot = db_session.scalar(
        select(RegressionSnapshot).where(
            RegressionSnapshot.project_id == UUID(project["id"]),
            RegressionSnapshot.scope_type == "project",
            RegressionSnapshot.metric_name == "success_rate",
        )
    )

    assert snapshot is not None
    assert snapshot.current_value == Decimal("0.100000")
    assert snapshot.baseline_value == Decimal("1.000000")
    assert snapshot.delta_absolute == Decimal("-0.900000")
    assert snapshot.delta_percent == Decimal("-0.900000")


def test_incident_opening_and_dedupe(client, db_session, fake_queue):
    _, _, project, latest_trace_id = _seed_success_rate_regression(client, db_session)

    incidents = db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "success_rate_drop",
        )
    ).all()
    assert len(incidents) == 2

    _run_signal_pipeline(db_session, latest_trace_id)

    deduped = db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "success_rate_drop",
        )
    ).all()
    assert len(deduped) == 2
    assert all(incident.status == "open" for incident in deduped)
    assert all(incident.summary_json["metric_name"] == "success_rate" for incident in deduped)


def test_incident_events_created_for_ack_owner_resolve_and_reopen(client, db_session, fake_queue):
    _set_env("SLACK_WEBHOOK_DEFAULT", None)
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    acknowledge_response = client.post(
        f"/api/v1/incidents/{incident.id}/acknowledge",
        headers=auth_headers(owner_session),
    )
    assert acknowledge_response.status_code == 200

    owner_response = client.post(
        f"/api/v1/incidents/{incident.id}/owner",
        headers=auth_headers(owner_session),
        json={"owner_operator_user_id": owner_session["operator"]["id"]},
    )
    assert owner_response.status_code == 200

    resolve_response = client.post(
        f"/api/v1/incidents/{incident.id}/resolve",
        headers=auth_headers(owner_session),
    )
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "resolved"

    reopen_response = client.post(
        f"/api/v1/incidents/{incident.id}/reopen",
        headers=auth_headers(owner_session),
    )
    assert reopen_response.status_code == 200
    assert reopen_response.json()["status"] == "open"

    events = db_session.scalars(
        select(IncidentEvent)
        .where(IncidentEvent.incident_id == incident.id)
        .order_by(IncidentEvent.created_at)
    ).all()
    event_types = [event.event_type for event in events]

    assert "acknowledged" in event_types
    assert "owner_assigned" in event_types
    assert "resolved" in event_types
    assert "reopened" in event_types


def test_deterministic_reopen_behavior_reuses_same_incident(client, db_session, fake_queue):
    owner_session, _, project, latest_trace_id = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")
    original_id = incident.id

    resolve_response = client.post(
        f"/api/v1/incidents/{incident.id}/resolve",
        headers=auth_headers(owner_session),
    )
    assert resolve_response.status_code == 200

    _run_signal_pipeline(db_session, latest_trace_id)

    reopened = _incident_for_type(db_session, project["id"], "success_rate_drop")
    assert reopened.id == original_id
    assert reopened.status == "open"
    reopen_event = db_session.scalar(
        select(IncidentEvent)
        .where(
            IncidentEvent.incident_id == reopened.id,
            IncidentEvent.event_type == "reopened",
        )
        .order_by(desc(IncidentEvent.created_at))
    )
    assert reopen_event is not None
    assert reopen_event.metadata_json["reason"] == "threshold_breached_again"


def test_incident_and_event_endpoints_are_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = db_session.scalar(select(Incident).where(Incident.project_id == UUID(project["id"])))
    assert incident is not None

    outsider = create_operator(db_session, email="outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)

    list_response = client.get("/api/v1/incidents", headers=auth_headers(outsider_session))
    assert list_response.status_code == 200
    assert list_response.json()["items"] == []

    detail_response = client.get(
        f"/api/v1/incidents/{incident.id}",
        headers=auth_headers(outsider_session),
    )
    assert detail_response.status_code == 404

    events_response = client.get(
        f"/api/v1/incidents/{incident.id}/events",
        headers=auth_headers(outsider_session),
    )
    assert events_response.status_code == 404

    regressions_response = client.get(
        f"/api/v1/projects/{project['id']}/regressions",
        headers=auth_headers(outsider_session),
    )
    assert regressions_response.status_code == 403

    owner_incidents = client.get("/api/v1/incidents", headers=auth_headers(owner_session))
    assert owner_incidents.status_code == 200
    assert len(owner_incidents.json()["items"]) >= 1


def test_alert_enqueue_on_incident_open(client, db_session, fake_queue):
    _set_env("SLACK_WEBHOOK_DEFAULT", "https://hooks.slack.test/services/default")
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    opened_incidents = _list_open_incidents(db_session, project["id"])

    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=opened_incidents)
    db_session.commit()
    pending = [delivery for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING]

    for delivery in pending:
        enqueue_alert_delivery_job(delivery.id)

    assert pending
    assert any(job[0].__name__ == "run_alert_delivery" for job in fake_queue.jobs)


def test_alert_cooldown_suppresses_duplicate_delivery(client, db_session, fake_queue):
    _set_env("SLACK_WEBHOOK_DEFAULT", "https://hooks.slack.test/services/default")
    _, _, project, _ = _seed_success_rate_regression(client, db_session)
    opened_incidents = _list_open_incidents(db_session, project["id"])
    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=opened_incidents)
    db_session.commit()

    pending = next(delivery for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING)
    pending.delivery_status = ALERT_STATUS_SENT
    pending.sent_at = datetime.now(timezone.utc)
    db_session.add(pending)
    db_session.commit()

    duplicate = create_alert_deliveries_for_open_incidents(
        db_session, incidents=[db_session.get(Incident, pending.incident_id)]
    )
    db_session.commit()

    assert duplicate[0].delivery_status == ALERT_STATUS_SUPPRESSED
    assert duplicate[0].error_message == "Suppressed by alert cooldown"


def test_slack_retry_behavior_is_bounded_and_records_events(
    client, db_session, fake_queue, monkeypatch
):
    _set_env("SLACK_WEBHOOK_DEFAULT", "https://hooks.slack.test/services/default")
    _set_env("SLACK_ALERT_MAX_ATTEMPTS", "3")
    _set_env("SLACK_ALERT_RETRY_BACKOFF_SECONDS", "60,300")
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=[incident])
    db_session.commit()
    delivery = next(item for item in deliveries if item.delivery_status == ALERT_STATUS_PENDING)

    monkeypatch.setattr(
        "app.services.alerts.httpx.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(httpx.ConnectError("slack down")),
    )

    deliver_alert_delivery(db_session, delivery.id)
    db_session.refresh(delivery)
    assert delivery.delivery_status == ALERT_STATUS_PENDING
    assert delivery.attempt_count == 1
    assert delivery.next_attempt_at is not None

    deliver_alert_delivery(db_session, delivery.id)
    db_session.refresh(delivery)
    assert delivery.delivery_status == ALERT_STATUS_PENDING
    assert delivery.attempt_count == 1

    delivery.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.add(delivery)
    db_session.commit()
    deliver_alert_delivery(db_session, delivery.id)
    db_session.refresh(delivery)
    assert delivery.attempt_count == 2
    assert delivery.delivery_status == ALERT_STATUS_PENDING

    delivery.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.add(delivery)
    db_session.commit()
    deliver_alert_delivery(db_session, delivery.id)
    db_session.refresh(delivery)
    assert delivery.attempt_count == 3
    assert delivery.delivery_status == ALERT_STATUS_FAILED

    event_types = [
        event.event_type
        for event in db_session.scalars(
            select(IncidentEvent).where(IncidentEvent.incident_id == incident.id)
        ).all()
    ]
    assert "alert_attempted" in event_types
    assert "alert_failed" in event_types
    assert owner_session["operator"]["id"] is not None


def test_org_level_target_fallback_logic(client, db_session, fake_queue):
    _set_env("SLACK_WEBHOOK_DEFAULT", "https://hooks.slack.test/services/default")
    _, organization, project, _ = _seed_success_rate_regression(client, db_session)
    incident = _incident_for_type(db_session, project["id"], "success_rate_drop")

    target = OrganizationAlertTarget(
        organization_id=UUID(organization["id"]),
        channel_type="slack_webhook",
        channel_target="org:primary-slack",
        slack_webhook_url="https://hooks.slack.test/services/org",
        is_active=True,
    )
    db_session.add(target)
    db_session.commit()

    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=[incident])
    db_session.commit()
    assert deliveries[0].channel_target == "org:primary-slack"


def test_tenant_safe_alert_history_reads(client, db_session, fake_queue, monkeypatch):
    _set_env("SLACK_WEBHOOK_DEFAULT", "https://hooks.slack.test/services/default")
    monkeypatch.setattr(
        "app.services.alerts.httpx.post",
        lambda *args, **kwargs: type(
            "Resp",
            (),
            {
                "headers": {"x-slack-req-id": "req-1"},
                "raise_for_status": staticmethod(lambda: None),
            },
        )(),
    )
    owner_session, _, project, _ = _seed_success_rate_regression(client, db_session)
    opened_incidents = _list_open_incidents(db_session, project["id"])
    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=opened_incidents)
    db_session.commit()
    for delivery in deliveries:
        if delivery.delivery_status == ALERT_STATUS_PENDING:
            deliver_alert_delivery(db_session, delivery.id)

    incident = db_session.scalar(select(Incident).where(Incident.project_id == UUID(project["id"])))
    assert incident is not None

    owner_alerts = client.get(
        f"/api/v1/incidents/{incident.id}/alerts",
        headers=auth_headers(owner_session),
    )
    assert owner_alerts.status_code == 200
    assert owner_alerts.json()["items"]

    outsider = create_operator(db_session, email="alerts-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    outsider_alerts = client.get(
        f"/api/v1/incidents/{incident.id}/alerts",
        headers=auth_headers(outsider_session),
    )
    assert outsider_alerts.status_code == 404
