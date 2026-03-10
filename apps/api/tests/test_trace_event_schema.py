from datetime import datetime, timezone

import pytest

from app.events.trace_event_validator import validate_trace_event
from app.processors.dispatcher import dispatch_event_sync
from app.processors.base_processor import BaseProcessor
from app.services.event_stream import EventMessage
from app.workers.evaluation_consumer import run_evaluation_consumer
from .test_api import create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def _valid_event() -> dict:
    return {
        "event_version": 1,
        "event_type": "trace_ingested",
        "trace_id": "58de1ee4-43d1-4f29-9a22-80bc91d6908f",
        "timestamp": "2026-03-10T12:00:00Z",
        "organization_id": "b3f7fcb4-bb2d-48cf-8e14-6e2f1a9de701",
        "project_id": "c0cc6c2d-9fd8-4be0-a49e-032443916d2d",
        "model": {
            "provider": "openai",
            "family": "gpt-4.1-mini",
            "revision": "2026-03-01",
        },
        "prompt_version_id": "v1",
        "latency_ms": 120,
        "success": True,
        "tokens": {"input": 20, "output": 10},
        "cost_usd": 0.01,
        "evaluation": {"structured_output_valid": None, "quality_pass": None},
        "retrieval": {"latency_ms": 50, "chunks": 3},
        "metadata": {"route": "support"},
    }


def test_validate_trace_event_rejects_invalid_payload():
    payload = _valid_event()
    del payload["project_id"]

    with pytest.raises(ValueError):
        validate_trace_event(payload)


def test_validate_trace_event_rejects_unsupported_version():
    payload = _valid_event()
    payload["event_version"] = 2

    with pytest.raises(ValueError):
        validate_trace_event(payload)


def test_dispatcher_rejects_mutating_processors():
    payload = _valid_event()

    class MutatingProcessor(BaseProcessor):
        name = "mutator"
        topic = "trace_events"

        async def process(self, event):
            event.payload["latency_ms"] = 999

    report = dispatch_event_sync(
        EventMessage(
            topic="trace_events",
            key=payload["project_id"],
            partition=0,
            offset=0,
            event_type="trace_ingested",
            payload=payload,
            published_at=datetime.now(timezone.utc),
        ),
        processors=[MutatingProcessor()],
    )

    assert report.processor_results[0].success is False
    assert "mutated input event" in str(report.processor_results[0].error)


def test_evaluation_processor_keeps_input_event_immutable(client, db_session, fake_event_stream, fake_trace_warehouse):
    operator = create_operator(db_session, email="schema@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Schema Org", slug="schema-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T12:00:00Z",
            "request_id": "schema-trace",
            "model_name": "gpt-4.1-mini",
            "prompt_version": "v1",
            "output_text": "{\"ok\": true}",
            "success": True,
            "latency_ms": 140,
            "prompt_tokens": 12,
            "completion_tokens": 8,
            "metadata_json": {"expected_output_format": "json"},
        },
    )

    original_messages = list(fake_event_stream.consume("trace_events"))
    original_payload = dict(original_messages[0].payload)

    assert run_evaluation_consumer(max_events=1) == 1

    after_messages = list(fake_event_stream.consume("trace_events"))
    assert after_messages[0].payload == original_payload
    assert after_messages[1].event_type == "trace_evaluated"


def test_ingest_rejects_invalid_canonical_event(client, db_session, monkeypatch: pytest.MonkeyPatch):
    operator = create_operator(db_session, email="schema-invalid@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Schema Invalid Org", slug="schema-invalid-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    monkeypatch.setattr(
        "app.services.traces.build_trace_event_payload",
        lambda *args, **kwargs: {"event_version": 99},
    )

    response = client.post(
        "/api/v1/ingest/traces",
        headers={"x-api-key": api_key["api_key"]},
        json={
            "timestamp": "2026-03-10T12:00:00Z",
            "request_id": "schema-invalid-trace",
            "model_name": "gpt-4.1-mini",
            "success": True,
        },
    )

    assert response.status_code == 400
    assert "unsupported trace event version" in response.json()["detail"]
