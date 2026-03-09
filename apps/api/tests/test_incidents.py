import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import desc, select

from app.core.settings import get_settings
from app.models.evaluation_rollup import EvaluationRollup
from app.models.incident import Incident
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.services.alerts import (
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


def _set_slack_webhook(url: str | None) -> None:
    if url is None:
        os.environ.pop("SLACK_WEBHOOK_DEFAULT", None)
    else:
        os.environ["SLACK_WEBHOOK_DEFAULT"] = url
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
        _run_signal_pipeline(db_session, UUID(response["trace_id"]))

    return session_payload, organization, project


def _list_open_incidents(db_session, project_id: str) -> list[Incident]:
    return db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project_id),
            Incident.status == "open",
        )
    ).all()


def test_rollups_persist_for_project_and_prompt_version_scopes(client, db_session, fake_queue):
    _, _, project = _seed_success_rate_regression(client, db_session)

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
    _, _, project = _seed_success_rate_regression(client, db_session)

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
    _, _, project = _seed_success_rate_regression(client, db_session)

    incidents = db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "success_rate_drop",
        )
    ).all()
    assert len(incidents) == 2

    latest_trace = db_session.scalar(
        select(Trace).where(Trace.project_id == UUID(project["id"])).order_by(desc(Trace.timestamp))
    )
    assert latest_trace is not None
    _run_signal_pipeline(db_session, latest_trace.id)

    deduped = db_session.scalars(
        select(Incident).where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "success_rate_drop",
        )
    ).all()
    assert len(deduped) == 2
    assert all(incident.status == "open" for incident in deduped)
    assert all(incident.summary_json["metric_name"] == "success_rate" for incident in deduped)


def test_incident_and_regression_endpoints_are_tenant_safe(client, db_session, fake_queue):
    owner_session, _, project = _seed_success_rate_regression(client, db_session)
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

    regressions_response = client.get(
        f"/api/v1/projects/{project['id']}/regressions",
        headers=auth_headers(outsider_session),
    )
    assert regressions_response.status_code == 403

    owner_incidents = client.get("/api/v1/incidents", headers=auth_headers(owner_session))
    assert owner_incidents.status_code == 200
    assert len(owner_incidents.json()["items"]) >= 1


def test_alert_enqueue_on_incident_open(client, db_session, fake_queue):
    _set_slack_webhook("https://hooks.slack.test/services/default")
    _, _, project = _seed_success_rate_regression(client, db_session)
    opened_incidents = _list_open_incidents(db_session, project["id"])

    deliveries = create_alert_deliveries_for_open_incidents(db_session, incidents=opened_incidents)
    db_session.commit()
    pending = [delivery for delivery in deliveries if delivery.delivery_status == ALERT_STATUS_PENDING]

    for delivery in pending:
        enqueue_alert_delivery_job(delivery.id)

    assert pending
    assert any(job[0].__name__ == "run_alert_delivery" for job in fake_queue.jobs)


def test_alert_cooldown_suppresses_duplicate_delivery(client, db_session, fake_queue):
    _set_slack_webhook("https://hooks.slack.test/services/default")
    _, _, project = _seed_success_rate_regression(client, db_session)
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


def test_acknowledge_and_owner_assignment_actions(client, db_session, fake_queue):
    _set_slack_webhook(None)
    owner_session, _, project = _seed_success_rate_regression(client, db_session)
    incident = db_session.scalar(select(Incident).where(Incident.project_id == UUID(project["id"])))
    assert incident is not None

    acknowledge_response = client.post(
        f"/api/v1/incidents/{incident.id}/acknowledge",
        headers=auth_headers(owner_session),
    )
    assert acknowledge_response.status_code == 200
    assert acknowledge_response.json()["acknowledged_by_operator_user_id"] == owner_session["operator"]["id"]
    assert acknowledge_response.json()["acknowledged_at"] is not None

    owner_response = client.post(
        f"/api/v1/incidents/{incident.id}/owner",
        headers=auth_headers(owner_session),
        json={"owner_operator_user_id": owner_session["operator"]["id"]},
    )
    assert owner_response.status_code == 200
    assert owner_response.json()["owner_operator_user_id"] == owner_session["operator"]["id"]
    assert owner_response.json()["owner_operator_email"] == "acme-incidents@acme.test"


def test_tenant_safe_alert_history_reads(client, db_session, fake_queue, monkeypatch):
    _set_slack_webhook("https://hooks.slack.test/services/default")
    monkeypatch.setattr("app.services.alerts.httpx.post", lambda *args, **kwargs: type("Resp", (), {
        "headers": {"x-slack-req-id": "req-1"},
        "raise_for_status": staticmethod(lambda: None),
    })())
    owner_session, _, project = _seed_success_rate_regression(client, db_session)
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
