from datetime import timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.incident import Incident
from app.models.trace import Trace
from app.services.auth import create_operator_user
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from app.workers.reliability_sweep import run_reliability_sweep_for_session
from app.workers.trace_warehouse_ingest import run_trace_warehouse_ingest
from .test_api import auth_headers, create_api_key, create_organization, create_project, ingest_trace, sign_in


def _run_signal_pipeline(db_session, trace_id: UUID) -> None:
    evaluation = run_structured_output_validity_evaluation(db_session, trace_id)
    assert evaluation is not None
    trace = db_session.get(Trace, trace_id)
    assert trace is not None
    project = trace.project
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


def test_operator_flow_smoke(client, db_session, fake_queue, fake_trace_warehouse):
    operator = create_operator_user(
        db_session,
        email="smoke-owner@acme.test",
        password="reliai-test-password",
    )
    db_session.commit()
    db_session.refresh(operator)

    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Smoke Org", slug="smoke-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    for index in range(12):
        baseline = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": f"2026-02-25T09:{index:02d}:00Z",
                "request_id": f"baseline_{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\":true}",
                "success": True,
                "latency_ms": 180,
                "prompt_tokens": 40,
                "completion_tokens": 10,
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        baseline_trace_id = UUID(baseline["trace_id"])
        _run_signal_pipeline(db_session, baseline_trace_id)
        run_trace_warehouse_ingest(str(baseline_trace_id))

    latest_trace_id = None
    for index in range(12):
        current = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": f"2026-02-25T10:{index:02d}:00Z",
                "request_id": f"current_{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "not-json",
                "success": False,
                "error_type": "provider_error",
                "latency_ms": 1200,
                "prompt_tokens": 45,
                "completion_tokens": 14,
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        latest_trace_id = UUID(current["trace_id"])
        _run_signal_pipeline(db_session, latest_trace_id)
        run_trace_warehouse_ingest(str(latest_trace_id))

    assert latest_trace_id is not None

    incident = db_session.scalar(
        select(Incident)
        .where(
            Incident.project_id == UUID(project["id"]),
            Incident.status == "open",
        )
        .order_by(Incident.started_at.desc())
    )
    assert incident is not None

    acknowledge = client.post(
        f"/api/v1/incidents/{incident.id}/acknowledge",
        headers=auth_headers(session_payload),
    )
    assert acknowledge.status_code == 200

    incident_compare = client.get(
        f"/api/v1/incidents/{incident.id}/compare",
        headers=auth_headers(session_payload),
    )
    assert incident_compare.status_code == 200
    assert incident_compare.json()["pairs"]
    assert incident_compare.json()["current_window_end"].startswith("2026-02-25")

    trace_compare = client.get(
        f"/api/v1/traces/{latest_trace_id}/compare",
        headers=auth_headers(session_payload),
    )
    assert trace_compare.status_code == 200
    assert trace_compare.json()["pairs"]

    linked_trace = db_session.get(Trace, latest_trace_id)
    assert linked_trace is not None
    assert linked_trace.prompt_version_record_id is not None
    assert linked_trace.model_version_record_id is not None

    project_record = linked_trace.project
    assert project_record is not None
    project_record.last_trace_received_at = linked_trace.created_at.replace(tzinfo=timezone.utc) - timedelta(minutes=45)
    db_session.add(project_record)
    db_session.commit()

    sweep_result = run_reliability_sweep_for_session(
        db_session,
        anchor_time=linked_trace.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )
    assert sweep_result["stale_incidents_opened"] >= 1

    stale_incident = db_session.scalar(
        select(Incident)
        .where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "telemetry_freshness_stale",
        )
        .order_by(Incident.started_at.desc())
    )
    assert stale_incident is not None
