from datetime import datetime, timedelta, timezone

from app.models.evaluation import Evaluation
from app.models.incident import Incident
from app.models.reliability_metric import ReliabilityMetric
from app.models.trace import Trace
from app.services.event_stream import TRACE_EVALUATED_EVENT, TRACE_INGESTED_EVENT
from app.workers.evaluation_consumer import run_evaluation_consumer
from app.workers.regression_detection_consumer import run_regression_detection_consumer
from app.workers.reliability_metrics_consumer import run_reliability_metrics_consumer
from app.workers.trace_warehouse_consumer import run_trace_warehouse_consumer
from .test_api import create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_trace_ingest_publishes_trace_event(client, db_session, fake_event_stream):
    operator = create_operator(db_session, email="events@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Events Org", slug="events-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "trace-event-1",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "latency_ms": 120,
            "metadata_json": {"route": "support"},
        },
    )

    messages = list(fake_event_stream.consume("trace_events"))
    assert len(messages) == 1
    message = messages[0]
    assert message.event_type == TRACE_INGESTED_EVENT
    assert message.key == project["id"]
    assert message.payload["trace_id"] == response["trace_id"]
    assert message.payload["event_version"] == 1
    assert message.payload["organization_id"] == organization["id"]
    assert message.payload["project_id"] == project["id"]
    production_environment_id = next(
        environment["id"]
        for environment in project["environments"]
        if environment["name"] == "production"
    )
    assert message.payload["environment_id"] == production_environment_id
    assert message.payload["model"]["family"] in {"gpt-4.1-mini", "gpt-4-mini"}


def test_trace_consumers_process_trace_event(
    client,
    db_session,
    fake_event_stream,
    fake_trace_warehouse,
    fake_queue,
):
    operator = create_operator(db_session, email="pipeline@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Pipeline Org", slug="pipeline-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    baseline_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=3)
    for offset in range(10):
        ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_time + timedelta(minutes=offset)).isoformat(),
                "request_id": f"pipeline-baseline-{offset}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}",
                "success": True,
                "error_type": None,
                "latency_ms": 220,
                "prompt_tokens": 40,
                "completion_tokens": 15,
                "metadata_json": {"expected_output_format": "json"},
            },
        )
    current_time = baseline_time + timedelta(hours=1)
    for offset in range(10):
        ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (current_time + timedelta(minutes=offset)).isoformat(),
                "request_id": f"pipeline-current-{offset}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}" if offset == 0 else "not-json",
                "success": offset == 0,
                "error_type": None if offset == 0 else "provider_error",
                "latency_ms": 300 if offset == 0 else 1200,
                "prompt_tokens": 40,
                "completion_tokens": 15,
                "metadata_json": {"expected_output_format": "json"},
            },
        )

    assert run_evaluation_consumer(max_events=20) == 20
    messages = list(fake_event_stream.consume("trace_events"))
    assert len([message for message in messages if message.event_type == TRACE_INGESTED_EVENT]) == 20
    evaluated_messages = [message for message in messages if message.event_type == TRACE_EVALUATED_EVENT]
    assert len(evaluated_messages) == 20
    assert evaluated_messages[0].payload["metadata"]["evaluation_result"]["eval_type"] == "structured_validity"
    assert "structured_output_valid" in evaluated_messages[0].payload["evaluation"]
    assert evaluated_messages[0].payload["environment_id"] is not None

    assert run_trace_warehouse_consumer(max_events=20) == 20
    assert run_reliability_metrics_consumer(max_events=20) == 20
    assert run_regression_detection_consumer(max_events=20) == 20

    traces = db_session.query(Trace).all()
    assert len(traces) == 20
    # each trace now produces multiple evaluations (structured_validity + refusal_detection + any custom metrics)
    assert db_session.query(Evaluation).count() >= 20
    assert len(fake_trace_warehouse.rows) == 20
    assert all(row.environment_id is not None for row in fake_trace_warehouse.rows.values())
    assert db_session.query(ReliabilityMetric).count() > 0
    assert db_session.query(Incident).count() > 0


def test_trace_event_ordering_is_stable_per_project(client, db_session, fake_event_stream):
    operator = create_operator(db_session, email="ordering@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Ordering Org", slug="ordering-org")
    first_project = create_project(client, session_payload, organization["id"], name="Project One")
    second_project = create_project(client, session_payload, organization["id"], name="Project Two")
    first_key = create_api_key(client, session_payload, first_project["id"])
    second_key = create_api_key(client, session_payload, second_project["id"])

    ingest_trace(
        client,
        first_key["api_key"],
        {
            "timestamp": "2026-03-09T12:00:00Z",
            "request_id": "p1-a",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )
    ingest_trace(
        client,
        second_key["api_key"],
        {
            "timestamp": "2026-03-09T12:01:00Z",
            "request_id": "p2-a",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )
    ingest_trace(
        client,
        first_key["api_key"],
        {
            "timestamp": "2026-03-09T12:02:00Z",
            "request_id": "p1-b",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )

    messages = list(fake_event_stream.consume("trace_events"))
    first_project_messages = [message for message in messages if message.key == first_project["id"]]

    assert len({message.partition for message in first_project_messages}) == 1
    assert [message.payload["timestamp"] for message in first_project_messages] == [
        "2026-03-09T12:00:00Z",
        "2026-03-09T12:02:00Z",
    ]
    assert [message.offset for message in first_project_messages] == sorted(
        message.offset for message in first_project_messages
    )
