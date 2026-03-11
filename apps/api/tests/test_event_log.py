from datetime import datetime, timezone
from uuid import UUID

from app.models.event_log import EventLog
from app.services.event_stream import publish_event
from app.workers.reprocess_events_worker import reprocess_events
from .test_api import create_operator, create_organization, create_project, sign_in


def test_publish_event_persists_event_log(client, db_session, fake_event_stream):
    operator = create_operator(db_session, email="event-log@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Event Log Org", slug="event-log-org")
    project = create_project(client, session_payload, organization["id"])

    message = publish_event(
        "trace_events",
        {
            "event_type": "trace_ingested",
            "event_version": 1,
            "organization_id": organization["id"],
            "project_id": project["id"],
            "trace_id": "trace-event-log-1",
            "timestamp": "2026-03-11T01:00:00Z",
            "success": True,
        },
    )

    row = db_session.query(EventLog).filter(EventLog.trace_id == "trace-event-log-1").one()
    assert row.event_type == "trace_ingested"
    assert row.organization_id == UUID(organization["id"])
    assert row.project_id == UUID(project["id"])
    assert row.payload_json["event_version"] == 1
    assert row.timestamp.replace(tzinfo=timezone.utc) == datetime(2026, 3, 11, 1, 0, tzinfo=timezone.utc)
    assert message.event_type == "trace_ingested"


def test_reprocess_events_replays_historical_event(
    client,
    db_session,
    fake_event_stream,
    monkeypatch,
):
    operator = create_operator(db_session, email="event-replay@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Replay Org", slug="replay-org")
    project = create_project(client, session_payload, organization["id"])

    publish_event(
        "trace_events",
        {
            "event_type": "trace_ingested",
            "event_version": 1,
            "organization_id": organization["id"],
            "project_id": project["id"],
            "trace_id": "trace-replay-1",
            "timestamp": "2026-03-11T02:00:00Z",
            "success": True,
        },
    )

    replayed: list[tuple[str, str, str]] = []

    monkeypatch.setattr(
        "app.workers.reprocess_events_worker.processors_for_topic",
        lambda topic: [object()] if topic == "trace_events" else [],
    )
    monkeypatch.setattr(
        "app.workers.reprocess_events_worker.dispatch_event_sync",
        lambda event: replayed.append((event.topic, event.event_type, str(event.payload["trace_id"]))),
    )

    count = reprocess_events(
        event_types=["trace_ingested"],
        project_id=UUID(project["id"]),
        max_events=10,
    )

    assert count == 1
    assert replayed == [("trace_events", "trace_ingested", "trace-replay-1")]
