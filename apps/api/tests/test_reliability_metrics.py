from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select

from app.models.evaluation import Evaluation
from app.models.alert_delivery import AlertDelivery
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.project import Project
from app.models.regression_snapshot import RegressionSnapshot
from app.models.reliability_metric import ReliabilityMetric
from app.models.trace import Trace
from app.services.reliability_metrics import (
    METRIC_ALERT_DELIVERY_SUCCESS_RATE,
    METRIC_DETECTION_COVERAGE,
    METRIC_EXPLAINABILITY_SCORE,
    METRIC_FALSE_POSITIVE_RATE,
    METRIC_INCIDENT_DENSITY,
    METRIC_INCIDENT_DETECTION_LATENCY_P90,
    METRIC_MTTA_P90,
    METRIC_MTTR_P90,
    METRIC_TELEMETRY_FRESHNESS_MINUTES,
    compute_project_reliability_metrics,
)
from app.services.incidents import sync_telemetry_freshness_incident

from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _metric_value(db_session, project_id: str, metric_name: str) -> ReliabilityMetric:
    row = db_session.scalar(
        select(ReliabilityMetric)
        .where(
            ReliabilityMetric.project_id == UUID(project_id),
            ReliabilityMetric.metric_name == metric_name,
            ReliabilityMetric.scope_type == "project",
            ReliabilityMetric.scope_id == project_id,
        )
        .order_by(ReliabilityMetric.window_end.desc())
    )
    assert row is not None
    return row


def _seed_metric_inputs(client, db_session):
    owner = create_operator(db_session, email="metrics-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Acme Metrics", slug="acme-metrics")
    project = create_project(client, session_payload, organization["id"], name="Reliability API")
    project_record = db_session.get(Project, UUID(project["id"]))
    assert project_record is not None

    anchor = datetime(2026, 3, 9, 12, 0, tzinfo=timezone.utc)
    current_window_start = anchor - timedelta(minutes=20)
    current_window_end = anchor
    baseline_window_start = current_window_start - timedelta(minutes=60)
    baseline_window_end = current_window_start

    regression_with_incident = RegressionSnapshot(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        metric_name="success_rate",
        current_value=Decimal("0.60"),
        baseline_value=Decimal("0.90"),
        delta_absolute=Decimal("-0.30"),
        delta_percent=Decimal("-0.333333"),
        scope_type="project",
        scope_id=project["id"],
        window_minutes=60,
        detected_at=anchor - timedelta(minutes=30),
        metadata_json={
            "current_window_start": current_window_start.isoformat(),
            "current_window_end": current_window_end.isoformat(),
            "baseline_window_start": baseline_window_start.isoformat(),
            "baseline_window_end": baseline_window_end.isoformat(),
            "current_sample_size": 20,
            "baseline_sample_size": 20,
        },
    )
    regression_without_incident = RegressionSnapshot(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        metric_name="p95_latency_ms",
        current_value=Decimal("900"),
        baseline_value=Decimal("400"),
        delta_absolute=Decimal("500"),
        delta_percent=Decimal("1.250000"),
        scope_type="project",
        scope_id=project["id"],
        window_minutes=60,
        detected_at=anchor - timedelta(minutes=15),
        metadata_json={
            "current_window_start": current_window_start.isoformat(),
            "current_window_end": current_window_end.isoformat(),
            "baseline_window_start": baseline_window_start.isoformat(),
            "baseline_window_end": baseline_window_end.isoformat(),
            "current_sample_size": 20,
            "baseline_sample_size": 20,
        },
    )
    db_session.add_all([regression_with_incident, regression_without_incident])
    db_session.flush()

    incident = Incident(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        incident_type="success_rate_drop",
        severity="high",
        title="Success rate dropped",
        status="resolved",
        fingerprint=f"{organization['id']}:{project['id']}:success-rate",
        summary_json={
            "metric_name": "success_rate",
            "scope_type": "project",
            "scope_id": project["id"],
            "regression_snapshot_ids": [str(regression_with_incident.id)],
        },
        started_at=anchor - timedelta(minutes=28),
        updated_at=anchor - timedelta(minutes=5),
        resolved_at=anchor - timedelta(minutes=5),
        acknowledged_at=anchor - timedelta(minutes=20),
    )
    false_positive_incident = Incident(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        incident_type="average_cost_spike",
        severity="medium",
        title="Average cost spiked",
        status="resolved",
        fingerprint=f"{organization['id']}:{project['id']}:average-cost",
        summary_json={
            "metric_name": "average_cost_usd_per_trace",
            "scope_type": "project",
            "scope_id": project["id"],
            "regression_snapshot_ids": [],
        },
        started_at=anchor - timedelta(minutes=18),
        updated_at=anchor - timedelta(minutes=8),
        resolved_at=anchor - timedelta(minutes=8),
        acknowledged_at=None,
    )
    db_session.add_all([incident, false_positive_incident])
    db_session.flush()

    db_session.add_all(
        [
            IncidentEvent(
                incident_id=incident.id,
                event_type="opened",
                created_at=anchor - timedelta(minutes=27),
                metadata_json={"metric_name": "success_rate"},
            ),
            IncidentEvent(
                incident_id=incident.id,
                event_type="reopened",
                created_at=anchor - timedelta(minutes=12),
                metadata_json={"metric_name": "success_rate"},
            ),
        ]
    )
    db_session.add_all(
        [
            AlertDelivery(
                incident_id=incident.id,
                channel_type="slack_webhook",
                channel_target="slack_webhook_default",
                delivery_status="sent",
                sent_at=anchor - timedelta(minutes=26),
                created_at=anchor - timedelta(minutes=26),
            ),
            AlertDelivery(
                incident_id=incident.id,
                channel_type="slack_webhook",
                channel_target="slack_webhook_default",
                delivery_status="failed",
                error_message="boom",
                created_at=anchor - timedelta(minutes=25),
            ),
        ]
    )

    explainable_trace = Trace(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment="prod",
        timestamp=anchor - timedelta(minutes=10),
        request_id="trace-explainable",
        model_name="gpt-4.1-mini",
        model_provider="openai",
        prompt_version="v1",
        latency_ms=320,
        prompt_tokens=100,
        completion_tokens=30,
        total_cost_usd=Decimal("0.040000"),
        is_explainable=True,
        success=False,
        error_type="provider_error",
        created_at=anchor - timedelta(minutes=10),
    )
    partial_trace = Trace(
        organization_id=UUID(organization["id"]),
        project_id=UUID(project["id"]),
        environment="prod",
        timestamp=anchor - timedelta(hours=2),
        request_id="trace-partial",
        model_name="gpt-4.1-mini",
        model_provider="openai",
        prompt_version=None,
        latency_ms=None,
        prompt_tokens=None,
        completion_tokens=None,
        total_cost_usd=Decimal("0.010000"),
        is_explainable=False,
        success=True,
        error_type=None,
        created_at=anchor - timedelta(hours=2),
    )
    db_session.add_all([explainable_trace, partial_trace])
    project_record.last_trace_received_at = anchor - timedelta(minutes=20)
    db_session.add(project_record)
    db_session.commit()
    return project_record, anchor


def test_reliability_metric_calculations(client, db_session, fake_queue):
    project, anchor = _seed_metric_inputs(client, db_session)

    compute_project_reliability_metrics(db_session, project=project, anchor_time=anchor)
    db_session.commit()

    detection_latency = _metric_value(db_session, str(project.id), METRIC_INCIDENT_DETECTION_LATENCY_P90)
    assert detection_latency.value_number == 3.0

    mtta = _metric_value(db_session, str(project.id), METRIC_MTTA_P90)
    assert mtta.value_number == 8.0

    mttr = _metric_value(db_session, str(project.id), METRIC_MTTR_P90)
    assert mttr.value_number == 23.0

    coverage = _metric_value(db_session, str(project.id), METRIC_DETECTION_COVERAGE)
    assert coverage.value_number == 0.5

    false_positive_rate = _metric_value(db_session, str(project.id), METRIC_FALSE_POSITIVE_RATE)
    assert false_positive_rate.value_number == 0.5

    alert_success_rate = _metric_value(db_session, str(project.id), METRIC_ALERT_DELIVERY_SUCCESS_RATE)
    assert alert_success_rate.value_number == 0.5


def test_telemetry_freshness_and_explainability_and_density(client, db_session, fake_queue):
    project, anchor = _seed_metric_inputs(client, db_session)

    compute_project_reliability_metrics(db_session, project=project, anchor_time=anchor)
    db_session.commit()

    freshness = _metric_value(db_session, str(project.id), METRIC_TELEMETRY_FRESHNESS_MINUTES)
    assert freshness.value_number == 20.0

    explainability = _metric_value(db_session, str(project.id), METRIC_EXPLAINABILITY_SCORE)
    assert explainability.value_number == 0.5

    density = _metric_value(db_session, str(project.id), METRIC_INCIDENT_DENSITY)
    assert density.value_number > 0


def test_reliability_worker_opens_stale_telemetry_incident(client, db_session, fake_queue):
    project, anchor = _seed_metric_inputs(client, db_session)

    sync_telemetry_freshness_incident(
        db_session,
        project=project,
        freshness_minutes=45.0,
        detected_at=anchor,
    )
    db_session.commit()

    stale_incident = db_session.scalar(
        select(Incident).where(
            Incident.project_id == project.id,
            Incident.incident_type == "telemetry_freshness_stale",
        )
    )
    assert stale_incident is not None
    assert stale_incident.status == "open"


def test_reliability_endpoint_is_tenant_safe_and_returns_scorecard(client, db_session, fake_queue):
    owner = create_operator(db_session, email="reliability-owner@acme.test")
    owner_session = sign_in(client, email=owner.email)
    organization = create_organization(client, owner_session, name="Reliability Org", slug="reliability-org")
    project = create_project(client, owner_session, organization["id"], name="Reliability Service")
    api_key = create_api_key(client, owner_session, project["id"])
    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "rel-score",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "latency_ms": 210,
            "prompt_tokens": 50,
            "completion_tokens": 20,
            "total_cost_usd": "0.010000",
            "success": True,
            "metadata_json": {"expected_output_format": "json"},
            "output_text": "{\"ok\":true}",
        },
    )
    trace = db_session.query(Trace).filter(Trace.request_id == "rel-score").one()
    assert trace is not None
    evaluation = Evaluation(
        trace_id=trace.id,
        project_id=trace.project_id,
        eval_type="structured_validity",
        label="pass",
        explanation="Output parsed as valid JSON.",
    )
    db_session.add(evaluation)
    project_record = db_session.get(Project, UUID(project["id"]))
    assert project_record is not None
    compute_project_reliability_metrics(db_session, project=project_record, anchor_time=trace.created_at)
    db_session.commit()

    response = client.get(
        f"/api/v1/projects/{project['id']}/reliability",
        headers=auth_headers(owner_session),
    )
    assert response.status_code == 200
    payload = response.json()
    assert "detection_latency_p90" in payload
    assert "trend_series" in payload
    assert "recent_incidents" in payload

    outsider = create_operator(db_session, email="reliability-outsider@beta.test")
    outsider_session = sign_in(client, email=outsider.email)
    forbidden = client.get(
        f"/api/v1/projects/{project['id']}/reliability",
        headers=auth_headers(outsider_session),
    )
    assert forbidden.status_code == 403
