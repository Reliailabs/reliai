from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, select

from app.models.evaluation import Evaluation
from app.models.incident import Incident
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.trace import Trace
from app.services.evaluations import (
    run_project_custom_metric_evaluations,
    run_refusal_detection_evaluation,
    run_structured_output_validity_evaluation,
)
from app.services.incidents import sync_incidents_for_scope
from app.services.regressions import compute_regressions_for_scope
from app.services.rollups import build_scopes
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_operator_project(client, db_session, *, email: str, slug: str):
    operator = create_operator(db_session, email=email)
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug=slug)
    project = create_project(client, session_payload, organization["id"], name="Support Copilot")
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def _run_signal_pipeline(db_session, trace_id: UUID) -> None:
    structured = run_structured_output_validity_evaluation(db_session, trace_id)
    assert structured is not None
    refusal = run_refusal_detection_evaluation(db_session, trace_id)
    assert refusal is not None
    run_project_custom_metric_evaluations(db_session, trace_id)

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


def test_refusal_detection_evaluator_true_and_false(client, db_session):
    _, _, api_key = _seed_operator_project(
        client,
        db_session,
        email="refusal-detector@acme.test",
        slug="refusal-detector-org",
    )

    refusal_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-25T10:00:00Z",
            "request_id": "refusal_yes",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "output_text": "I cannot help with that request.",
        },
    )
    normal_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-25T10:01:00Z",
            "request_id": "refusal_no",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "output_text": "Here is a concrete answer with supporting details.",
        },
    )

    refusal_eval = run_refusal_detection_evaluation(db_session, UUID(refusal_trace["trace_id"]))
    normal_eval = run_refusal_detection_evaluation(db_session, UUID(normal_trace["trace_id"]))

    assert refusal_eval is not None
    assert normal_eval is not None
    assert refusal_eval.label == "fail"
    assert refusal_eval.raw_result_json["result_value"] is True
    assert normal_eval.label == "pass"
    assert normal_eval.raw_result_json["result_value"] is False


def test_refusal_rate_regression_creates_incident_signal(client, db_session):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email="refusal-rate-owner@acme.test",
        slug="refusal-rate-org",
    )

    baseline_start = datetime(2026, 3, 25, 10, 0, tzinfo=timezone.utc)
    current_start = datetime(2026, 3, 25, 11, 0, tzinfo=timezone.utc)

    for index in range(12):
        accepted = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_start + timedelta(minutes=index * 4)).isoformat(),
                "request_id": f"baseline_ok_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "success": True,
                "output_text": "Policy-compliant helpful answer.",
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        _run_signal_pipeline(db_session, UUID(accepted["trace_id"]))

    for index in range(12):
        accepted = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_start + timedelta(minutes=index * 4)).isoformat(),
                "request_id": f"current_refusal_{index}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "success": True,
                "output_text": (
                    "I cannot help with that."
                    if index < 8
                    else "Providing a concrete answer for this request."
                ),
                "metadata_json": {"expected_output_format": "json"},
            },
        )
        _run_signal_pipeline(db_session, UUID(accepted["trace_id"]))

    snapshot = db_session.scalar(
        select(RegressionSnapshot)
        .where(
            RegressionSnapshot.project_id == UUID(project["id"]),
            RegressionSnapshot.metric_name == "refusal_rate",
            RegressionSnapshot.scope_type == "project",
        )
        .order_by(desc(RegressionSnapshot.detected_at))
    )
    assert snapshot is not None
    assert snapshot.current_value > snapshot.baseline_value

    incident = db_session.scalar(
        select(Incident)
        .where(
            Incident.project_id == UUID(project["id"]),
            Incident.incident_type == "refusal_rate_spike",
            Incident.status == "open",
        )
        .order_by(desc(Incident.updated_at))
    )
    assert incident is not None
    assert incident.summary_json["metric_name"] == "refusal_rate"

    detail_response = client.get(
        f"/api/v1/incidents/{incident.id}",
        headers=auth_headers(session_payload),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["summary_json"]["metric_name"] == "refusal_rate"


def test_custom_metric_config_create_and_list(client, db_session):
    session_payload, project, _ = _seed_operator_project(
        client,
        db_session,
        email="custom-metric-owner@acme.test",
        slug="custom-metric-org",
    )

    create_response = client.post(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
        json={
            "name": "Escalation language",
            "metric_type": "keyword",
            "value_mode": "boolean",
            "keywords": ["escalate", "handoff"],
            "enabled": True,
        },
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["metric_type"] == "keyword"
    assert payload["metric_key"].startswith("escalation_language")

    list_response = client.get(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
    )
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1


def test_custom_metric_regex_and_keyword_evaluate_on_trace(client, db_session):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email="custom-metric-eval@acme.test",
        slug="custom-metric-eval-org",
    )

    regex_metric = client.post(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
        json={
            "name": "Escalation regex",
            "metric_type": "regex",
            "value_mode": "count",
            "pattern": "escalat(e|ion)",
            "enabled": True,
        },
    ).json()
    keyword_metric = client.post(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
        json={
            "name": "Policy keyword",
            "metric_type": "keyword",
            "value_mode": "boolean",
            "keywords": ["policy", "restricted"],
            "enabled": True,
        },
    ).json()

    accepted = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-25T12:00:00Z",
            "request_id": "custom_eval_trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "output_text": "We should escalate this ticket due to policy restrictions.",
        },
    )
    trace_id = UUID(accepted["trace_id"])
    evaluations = run_project_custom_metric_evaluations(db_session, trace_id)
    assert len(evaluations) == 2

    regex_eval = db_session.scalar(
        select(Evaluation).where(
            Evaluation.trace_id == trace_id,
            Evaluation.eval_type == f"custom_metric:{regex_metric['metric_key']}",
        )
    )
    keyword_eval = db_session.scalar(
        select(Evaluation).where(
            Evaluation.trace_id == trace_id,
            Evaluation.eval_type == f"custom_metric:{keyword_metric['metric_key']}",
        )
    )
    assert regex_eval is not None
    assert keyword_eval is not None
    assert regex_eval.label == "hit"
    assert keyword_eval.label == "hit"


def test_disabled_custom_metrics_do_not_execute(client, db_session):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email="custom-metric-disabled@acme.test",
        slug="custom-metric-disabled-org",
    )

    metric = client.post(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
        json={
            "name": "Disabled signal",
            "metric_type": "keyword",
            "value_mode": "boolean",
            "keywords": ["disabled"],
            "enabled": False,
        },
    ).json()

    accepted = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-25T12:10:00Z",
            "request_id": "disabled_metric_trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "output_text": "This contains disabled keyword",
        },
    )
    trace_id = UUID(accepted["trace_id"])
    run_project_custom_metric_evaluations(db_session, trace_id)

    eval_row = db_session.scalar(
        select(Evaluation).where(
            Evaluation.trace_id == trace_id,
            Evaluation.eval_type == f"custom_metric:{metric['metric_key']}",
        )
    )
    assert eval_row is None


def test_malformed_regex_metric_is_safe_and_marked_warning(client, db_session):
    session_payload, project, api_key = _seed_operator_project(
        client,
        db_session,
        email="custom-metric-malformed@acme.test",
        slug="custom-metric-malformed-org",
    )

    metric = client.post(
        f"/api/v1/projects/{project['id']}/custom-metrics",
        headers=auth_headers(session_payload),
        json={
            "name": "Bad regex",
            "metric_type": "regex",
            "value_mode": "count",
            "pattern": "([a-z",
            "enabled": True,
        },
    ).json()

    accepted = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-25T12:20:00Z",
            "request_id": "malformed_regex_trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "output_text": "regular response",
        },
    )
    trace_id = UUID(accepted["trace_id"])
    run_project_custom_metric_evaluations(db_session, trace_id)

    eval_row = db_session.scalar(
        select(Evaluation).where(
            Evaluation.trace_id == trace_id,
            Evaluation.eval_type == f"custom_metric:{metric['metric_key']}",
        )
    )
    assert eval_row is not None
    assert eval_row.label == "warning"
    assert eval_row.raw_result_json["status"] == "invalid_pattern"
