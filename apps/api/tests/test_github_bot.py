from app.integrations.github_bot import (
    extract_trace_ids,
    format_trace_summary_comment,
    process_github_comment_webhook,
)
from app.models.event_log import EventLog
from .test_api import (
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def test_extract_trace_ids_supports_canonical_links():
    body = (
        "Please investigate https://app.reliai.dev/traces/trace-alpha and "
        "https://app.reliai.dev/traces/trace-beta"
    )
    assert extract_trace_ids(body) == ["trace-alpha", "trace-beta"]


def test_format_trace_summary_comment_matches_incident_sharing_shape():
    comment = format_trace_summary_comment(
        {
            "trace_id": "trace-alpha",
            "service_name": "retriever",
            "model_name": "gpt-4.1-mini",
            "latency_ms": 980,
            "guardrail_retries": 2,
            "error_summary": "Hallucination spike after retriever rollout",
        }
    )
    assert "Reliai Trace Investigation" in comment
    assert "Service: retriever" in comment
    assert "Guardrail retries: 2" in comment
    assert "Investigate:\nhttps://app.reliai.dev/traces/trace-alpha" in comment


def test_process_github_comment_webhook_posts_once_per_trace_and_target(client, db_session):
    owner = create_operator(db_session, email="owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Acme AI", slug="acme-ai")
    project = create_project(client, session_payload, organization["id"])
    api_key_response = create_api_key(client, session_payload, project["id"])

    logical_trace_id = "trace-github-1"
    ingest_trace(
        client,
        api_key_response["api_key"],
        {
            "timestamp": "2026-03-09T12:02:00Z",
            "request_id": "req_github",
            "trace_id": logical_trace_id,
            "span_id": "root-span",
            "service_name": "agent",
            "model_name": "gpt-4.1-mini",
            "latency_ms": 1337,
            "success": False,
            "error_type": "HallucinationError",
            "metadata_json": {"guardrail_retry": True},
        },
    )

    posted: list[tuple[str, str]] = []

    payload = {
        "issue": {
            "id": 42,
            "comments_url": "https://api.github.com/repos/reliai/reliai/issues/42/comments",
        },
        "comment": {
            "body": f"Trace to inspect: https://app.reliai.dev/traces/{logical_trace_id}",
        },
    }

    first = process_github_comment_webhook(
        db_session,
        payload,
        post_comment=lambda comment_url, body: posted.append((comment_url, body)),
    )
    second = process_github_comment_webhook(
        db_session,
        payload,
        post_comment=lambda comment_url, body: posted.append((comment_url, body)),
    )

    assert first == [logical_trace_id]
    assert second == []
    assert len(posted) == 1
    assert posted[0][0].endswith("/issues/42/comments")
    assert "Latency: 1337 ms" in posted[0][1]
    assert "Guardrail retries: 1" in posted[0][1]

    logged = db_session.query(EventLog).filter(EventLog.event_type == "github_trace_summary_posted").all()
    assert len(logged) == 1
