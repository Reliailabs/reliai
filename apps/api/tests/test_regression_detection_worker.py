from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

from app.models.trace import Trace
from app.workers import regression_detection as regression_detection_worker
from .conftest import BorrowedSession
from .test_api import (
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_trace(client, db_session) -> UUID:
    operator = create_operator(db_session, email="regression-worker-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Reg Worker Org", slug="reg-worker-org")
    project = create_project(client, session_payload, organization["id"], name="Reg Worker Project")
    api_key = create_api_key(client, session_payload, project["id"])

    accepted = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "reg_worker_trace",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "success": False,
            "error_type": "provider_error",
            "output_text": "failed output",
            "metadata_json": {"expected_output_format": "json"},
        },
    )
    return UUID(accepted["trace_id"])


def test_regression_detection_does_not_fail_when_event_publish_raises(
    client,
    db_session,
    fake_queue,
    monkeypatch,
):
    trace_id = _seed_trace(client, db_session)
    trace = db_session.get(Trace, trace_id)
    assert trace is not None

    fake_scope = SimpleNamespace(
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        scope_type="project",
        scope_id=str(trace.project_id),
    )

    fake_incident = SimpleNamespace(
        id=uuid4(),
        project_id=trace.project_id,
        organization_id=trace.organization_id,
        environment_id=trace.environment_id,
        deployment_id=None,
        incident_type="success_rate_drop",
        severity="high",
        started_at=datetime.now(timezone.utc),
        summary_json={"metric_name": "success_rate"},
    )

    monkeypatch.setattr(regression_detection_worker, "build_scopes", lambda _trace: [fake_scope])
    monkeypatch.setattr(
        regression_detection_worker,
        "compute_regressions_for_scope",
        lambda db, scope, anchor_time: SimpleNamespace(snapshots=[]),
    )
    monkeypatch.setattr(
        regression_detection_worker,
        "sync_incidents_for_scope",
        lambda db, scope, project, regressions, detected_at: SimpleNamespace(
            opened_incidents=[fake_incident], reopened_incidents=[]
        ),
    )
    monkeypatch.setattr(
        regression_detection_worker,
        "create_alert_deliveries_for_open_incidents",
        lambda db, incidents: [],
    )
    monkeypatch.setattr(regression_detection_worker, "publish_event", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("broker down")))
    monkeypatch.setattr(regression_detection_worker, "enqueue_alert_delivery_job", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(regression_detection_worker, "SessionLocal", lambda: BorrowedSession(db_session))

    regression_detection_worker.run_trace_regression_detection(str(trace_id))
