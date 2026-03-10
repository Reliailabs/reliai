import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.processors.base_processor import BaseProcessor
from app.processors.dispatcher import dispatch_event, dispatch_event_sync
from app.processors.registry import ProcessorRegistry
from app.processors.runner import run_processor_runner
from app.services.event_stream import EventMessage
from .test_api import create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


@dataclass
class Marker:
    calls: list[str]


def _event(*, topic: str = "trace_events") -> EventMessage:
    return EventMessage(
        topic=topic,
        key="project-1",
        partition=0,
        offset=0,
        event_type="trace_ingested",
        payload={"trace_id": "trace-1", "project_id": "project-1", "timestamp": "2026-03-09T12:00:00Z"},
        published_at=datetime.now(timezone.utc),
    )


def test_processor_registry_tracks_subscriptions():
    registry = ProcessorRegistry()

    class OneProcessor(BaseProcessor):
        name = "one"
        topic = "trace_events"

        async def process(self, event):  # pragma: no cover - not used here
            return None

    class TwoProcessor(BaseProcessor):
        name = "two"
        topic = "trace_events"

        async def process(self, event):  # pragma: no cover - not used here
            return None

    registry.register_processor(OneProcessor)
    registry.register_processor(TwoProcessor)

    assert registry.list_processor_names() == ["one", "two"]
    assert registry.subscribed_topics() == ["trace_events"]
    assert [processor.name for processor in registry.processors_for_topic("trace_events")] == ["one", "two"]


def test_dispatcher_routes_event_to_multiple_processors():
    marker = Marker(calls=[])

    class FirstProcessor(BaseProcessor):
        name = "first"
        topic = "trace_events"

        async def process(self, event):
            marker.calls.append(f"first:{event.payload['trace_id']}")

    class SecondProcessor(BaseProcessor):
        name = "second"
        topic = "trace_events"

        async def process(self, event):
            marker.calls.append(f"second:{event.payload['trace_id']}")

    report = asyncio.run(dispatch_event(_event(), processors=[FirstProcessor(), SecondProcessor()]))

    assert marker.calls == ["first:trace-1", "second:trace-1"]
    assert [result.processor_name for result in report.processor_results] == ["first", "second"]
    assert all(result.success for result in report.processor_results)


def test_dispatcher_isolates_processor_failures():
    marker = Marker(calls=[])

    class FailingProcessor(BaseProcessor):
        name = "failing"
        topic = "trace_events"

        async def process(self, event):
            raise RuntimeError("boom")

    class HealthyProcessor(BaseProcessor):
        name = "healthy"
        topic = "trace_events"

        async def process(self, event):
            marker.calls.append(event.payload["trace_id"])

    report = dispatch_event_sync(_event(), processors=[FailingProcessor(), HealthyProcessor()])

    assert marker.calls == ["trace-1"]
    assert report.processor_results[0].success is False
    assert report.processor_results[1].success is True


def test_runner_can_limit_enabled_processors(
    client,
    db_session,
    fake_event_stream,
    fake_trace_warehouse,
    fake_queue,
):
    operator = create_operator(db_session, email="framework@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Framework Org", slug="framework-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    base_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=2)
    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": base_time.isoformat(),
            "request_id": "framework-1",
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

    reports = run_processor_runner(max_events=1, enabled_processors=["warehouse", "evaluation"])

    assert len(reports) == 1
    assert [result.processor_name for result in reports[0].processor_results] == ["evaluation", "warehouse"]
    assert len(fake_trace_warehouse.rows) == 1
