import argparse
from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, select

from app.core.settings import get_settings
from app.db.session import SessionLocal
from app.models.trace import Trace
from app.services.event_stream import TraceIngestedEventPayload, publish_event


def _build_payload(trace: Trace) -> dict:
    return TraceIngestedEventPayload(
        trace_id=str(trace.id),
        project_id=str(trace.project_id),
        timestamp=trace.timestamp,
        prompt_version_id=str(trace.prompt_version_record_id) if trace.prompt_version_record_id else None,
        model_version_id=str(trace.model_version_record_id) if trace.model_version_record_id else None,
        latency_ms=trace.latency_ms,
        success=trace.success,
        metadata=trace.metadata_json or {},
    ).model_dump(mode="json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay trace events into the event stream.")
    parser.add_argument("--project-id")
    parser.add_argument("--from-timestamp")
    parser.add_argument("--to-timestamp")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    settings = get_settings()
    db = SessionLocal()
    try:
        statement = select(Trace).order_by(asc(Trace.timestamp), asc(Trace.id))
        if args.project_id:
            statement = statement.where(Trace.project_id == UUID(args.project_id))
        if args.from_timestamp:
            statement = statement.where(Trace.timestamp >= datetime.fromisoformat(args.from_timestamp))
        if args.to_timestamp:
            statement = statement.where(Trace.timestamp <= datetime.fromisoformat(args.to_timestamp))
        if args.limit is not None:
            statement = statement.limit(args.limit)

        published = 0
        for trace in db.scalars(statement).all():
            publish_event(settings.event_stream_topic_traces, _build_payload(trace))
            published += 1
        print({"published": published, "topic": settings.event_stream_topic_traces})
    finally:
        db.close()


if __name__ == "__main__":
    main()
