from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.trace_query_adapter import TraceWindowQuery, query_trace_window
from app.services.trace_warehouse import TraceWarehouseAggregateQuery, aggregate_trace_metrics
from app.workers.trace_warehouse_ingest import run_trace_warehouse_ingest
from .test_api import create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_trace_warehouse_ingest_persists_trace_event(client, db_session, fake_queue, fake_trace_warehouse):
    operator = create_operator(db_session, email="warehouse@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Warehouse Org", slug="warehouse-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-01T12:00:00Z",
            "request_id": "warehouse-trace",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "output_text": "{\"ok\": true}",
            "success": True,
            "latency_ms": 220,
            "prompt_tokens": 34,
            "completion_tokens": 13,
            "metadata_json": {"expected_output_format": "json"},
            "retrieval": {
                "retrieval_latency_ms": 90,
                "source_count": 4,
                "top_k": 4,
            },
        },
    )

    trace_id = UUID(response["trace_id"])
    run_structured_output_validity_evaluation(db_session, trace_id)
    run_trace_warehouse_ingest(str(trace_id))

    row = fake_trace_warehouse.rows[str(trace_id)]
    assert row.project_id == UUID(project["id"])
    assert row.prompt_version_id is not None
    assert row.model_version_id is not None
    assert row.structured_output_valid is True
    assert row.retrieval_latency_ms == 90
    assert row.retrieval_chunks == 4
    assert row.metadata_json["__model_name"] == "gpt-4.1-mini"


def test_trace_query_adapter_uses_postgres_for_recent_windows(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
    monkeypatch,
):
    operator = create_operator(db_session, email="recent@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Recent Org", slug="recent-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    now = datetime.now(timezone.utc).replace(microsecond=0)
    response = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": now.isoformat(),
            "request_id": "recent-trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "output_text": "{\"ok\": true}",
            "success": True,
            "latency_ms": 180,
            "prompt_tokens": 20,
            "completion_tokens": 8,
        },
    )

    trace_id = UUID(response["trace_id"])

    def _unexpected_warehouse_call(*args, **kwargs):
        raise AssertionError("warehouse query should not be used for recent windows")

    monkeypatch.setattr("app.services.trace_query_adapter.query_traces", _unexpected_warehouse_call)

    traces = query_trace_window(
        db_session,
        TraceWindowQuery(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            window_start=now - timedelta(minutes=5),
            window_end=now + timedelta(minutes=5),
            with_details=True,
        ),
    )

    assert [trace.id for trace in traces] == [trace_id]


def test_trace_query_adapter_uses_warehouse_for_old_windows_and_aggregates(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
    monkeypatch,
):
    operator = create_operator(db_session, email="older@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Older Org", slug="older-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    base_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(days=10)
    trace_ids: list[UUID] = []
    for offset, success in enumerate((True, False)):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (base_time + timedelta(minutes=offset)).isoformat(),
                "request_id": f"old-{offset}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}" if success else "not-json",
                "success": success,
                "error_type": None if success else "provider_error",
                "latency_ms": 200 + (offset * 400),
                "prompt_tokens": 30,
                "completion_tokens": 12,
                "metadata_json": {"expected_output_format": "json"},
                "retrieval": {
                    "retrieval_latency_ms": 100 + offset,
                    "source_count": 3 + offset,
                },
            },
        )
        trace_id = UUID(response["trace_id"])
        trace_ids.append(trace_id)
        run_structured_output_validity_evaluation(db_session, trace_id)
        run_trace_warehouse_ingest(str(trace_id))

    monkeypatch.setattr(
        "app.services.trace_query_adapter._postgres_trace_window",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("postgres should not be used for old windows")),
    )

    traces = query_trace_window(
        db_session,
        TraceWindowQuery(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            window_start=base_time - timedelta(minutes=1),
            window_end=base_time + timedelta(minutes=5),
            with_details=True,
        ),
    )

    assert [trace.id for trace in traces] == [trace_ids[1], trace_ids[0]]
    assert traces[0].model_version_record is not None
    assert traces[0].prompt_version_record is not None
    assert traces[0].retrieval_span is not None
    assert traces[0].evaluations

    metrics = aggregate_trace_metrics(
        TraceWarehouseAggregateQuery(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            window_start=base_time - timedelta(minutes=1),
            window_end=base_time + timedelta(minutes=5),
        )
    )

    assert metrics["trace_count"] == 2
    assert metrics["success_rate"] == 0.5
    assert metrics["average_latency_ms"] == 400.0
    assert metrics["structured_output_validity_rate"] == 0.5
