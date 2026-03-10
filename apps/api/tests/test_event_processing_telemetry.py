from datetime import datetime, timedelta, timezone

from app.workers.evaluation_consumer import run_evaluation_consumer
from app.workers.regression_detection_consumer import run_regression_detection_consumer
from app.workers.reliability_metrics_consumer import run_reliability_metrics_consumer
from app.workers.trace_warehouse_consumer import run_trace_warehouse_consumer
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def _seed_pipeline_project(client, db_session, *, slug: str):
    operator = create_operator(db_session, email=f"{slug}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Pipeline Telemetry Org", slug=slug)
    project = create_project(client, session_payload, organization["id"], name="Pipeline Telemetry Service")
    api_key = create_api_key(client, session_payload, project["id"])
    return session_payload, project, api_key


def test_event_pipeline_endpoint_reports_consumer_health(
    client,
    db_session,
    fake_event_stream,
    fake_trace_warehouse,
    fake_queue,
):
    session_payload, _, api_key = _seed_pipeline_project(
        client,
        db_session,
        slug="pipeline-telemetry-health",
    )
    baseline_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(minutes=10)
    for offset in range(2):
        ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (baseline_time + timedelta(minutes=offset)).isoformat(),
                "request_id": f"pipeline-health-{offset}",
                "model_name": "gpt-4.1-mini",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}",
                "success": True,
                "latency_ms": 220 + offset,
                "prompt_tokens": 40,
                "completion_tokens": 12,
                "metadata_json": {"expected_output_format": "json"},
            },
        )

    assert run_evaluation_consumer(max_events=2) == 2
    assert run_trace_warehouse_consumer(max_events=2) == 2
    assert run_reliability_metrics_consumer(max_events=2) == 2
    assert run_regression_detection_consumer(max_events=2) == 2

    response = client.get(
        "/api/v1/system/event-pipeline",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()["pipeline"]

    assert payload["topic"] == "trace_events"
    assert payload["dead_letter_topic"] == "trace_events_dlq"
    assert payload["total_events_published"] == 2
    assert payload["consumers"]
    by_name = {item["consumer_name"]: item for item in payload["consumers"]}
    assert by_name["evaluation_consumer"]["health"] == "healthy"
    assert by_name["evaluation_consumer"]["lag"] == 0
    assert by_name["evaluation_consumer"]["processed_events_total"] == 2
    assert by_name["evaluation_consumer"]["error_count_total"] == 0
    assert by_name["trace_warehouse_consumer"]["processed_events_total"] == 2
    assert by_name["reliability_metrics_consumer"]["processed_events_total"] == 2
    assert by_name["regression_detection_consumer"]["processed_events_total"] == 2


def test_failed_consumer_event_is_sent_to_dead_letter_queue(
    client,
    db_session,
    fake_event_stream,
    fake_queue,
    monkeypatch,
):
    session_payload, _, api_key = _seed_pipeline_project(
        client,
        db_session,
        slug="pipeline-telemetry-dlq",
    )
    trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T12:00:00Z",
            "request_id": "pipeline-dlq-1",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "success": True,
            "latency_ms": 180,
        },
    )

    from app.processors import evaluation_processor

    monkeypatch.setattr(
        evaluation_processor,
        "process_trace_evaluation",
        lambda trace_id: (_ for _ in ()).throw(RuntimeError(f"boom:{trace_id}")),
    )

    assert run_evaluation_consumer(max_events=1) == 1

    dlq_messages = list(fake_event_stream.consume("trace_events_dlq"))
    assert len(dlq_messages) == 1
    assert dlq_messages[0].payload["consumer_name"] == "evaluation_consumer"
    assert dlq_messages[0].payload["trace_id"] == trace["trace_id"]
    assert dlq_messages[0].payload["source_topic"] == "trace_events"

    response = client.get(
        "/api/v1/system/event-pipeline",
        headers=auth_headers(session_payload),
    )
    assert response.status_code == 200
    payload = response.json()["pipeline"]
    by_name = {item["consumer_name"]: item for item in payload["consumers"]}
    assert by_name["evaluation_consumer"]["health"] == "degraded"
    assert by_name["evaluation_consumer"]["lag"] == 1
    assert by_name["evaluation_consumer"]["processed_events_total"] == 0
    assert by_name["evaluation_consumer"]["error_count_total"] == 1
