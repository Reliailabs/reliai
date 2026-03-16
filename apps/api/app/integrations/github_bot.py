from __future__ import annotations

import hashlib
import hmac
import json
import re
import urllib.request
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.event_log import EventLog
from app.models.trace import Trace
from app.services.traces import get_trace_summary_by_identifier, resolve_trace_identifier

GITHUB_TRACE_SUMMARY_EVENT = "github_trace_summary_posted"


def extract_trace_ids(text: str | None, hosts: list[str] | None = None) -> list[str]:
    if not text:
        return []
    settings = get_settings()
    candidates = hosts or [settings.canonical_dashboard_url, settings.app_url]
    seen: list[str] = []
    for base_url in candidates:
        host_pattern = re.escape(base_url.rstrip("/"))
        pattern = re.compile(rf"{host_pattern}/traces/([A-Za-z0-9\-]+)")
        for trace_id in pattern.findall(text):
            if trace_id not in seen:
                seen.append(trace_id)
    return seen


def verify_github_signature(body: bytes, signature_header: str | None) -> None:
    secret = get_settings().github_webhook_secret
    if not secret:
        return
    if not signature_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing GitHub signature")
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub signature")


def process_github_comment_webhook(
    db: Session,
    payload: dict[str, Any],
    *,
    post_comment: Any | None = None,
) -> list[str]:
    event_type = _event_type(payload)
    if event_type not in {"issue_comment", "pull_request_review_comment"}:
        return []

    comment = payload.get("comment") or {}
    trace_ids = extract_trace_ids(comment.get("body"))
    if not trace_ids:
        return []

    target_key = _target_key(payload)
    comment_url = _comment_url(payload)
    if target_key is None or comment_url is None:
        return []

    poster = post_comment or post_github_comment
    posted_trace_ids: list[str] = []
    for trace_id in trace_ids:
        if _already_posted(db, target_key=target_key, trace_id=trace_id):
            continue
        summary = get_trace_summary_by_identifier(db, trace_id)
        poster(comment_url, format_trace_summary_comment(summary))
        trace = _trace_for_identifier(db, trace_id)
        db.add(
            EventLog(
                event_id=uuid4(),
                event_type=GITHUB_TRACE_SUMMARY_EVENT,
                organization_id=trace.organization_id if trace is not None else None,
                project_id=trace.project_id if trace is not None else None,
                trace_id=trace_id,
                timestamp=datetime.now(timezone.utc),
                payload_json={"target_key": target_key, "trace_id": trace_id, "comment_url": comment_url},
            )
        )
        db.commit()
        posted_trace_ids.append(trace_id)
    return posted_trace_ids


def format_trace_summary_comment(summary: dict[str, Any]) -> str:
    latency = summary.get("latency_ms")
    latency_text = f"{latency} ms" if latency is not None else "n/a"
    return (
        "Reliai Trace Investigation\n\n"
        f"Service: {summary.get('service_name') or 'unknown'}\n"
        f"Model: {summary.get('model_name') or 'unknown'}\n"
        f"Latency: {latency_text}\n"
        f"Guardrail retries: {summary.get('guardrail_retries', 0)}\n"
        f"Error: {summary.get('error_summary') or 'none'}\n\n"
        "Investigate:\n"
        f"{shareable_trace_url(str(summary['trace_id']))}"
    )


def shareable_trace_url(trace_id: str) -> str:
    return f"{get_settings().canonical_dashboard_url.rstrip('/')}/traces/{trace_id}"


def post_github_comment(comment_url: str, body: str) -> None:
    token = get_settings().github_bot_token
    if not token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GitHub bot token not configured")
    request = urllib.request.Request(
        comment_url,
        data=json.dumps({"body": body}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10):
        return


def _already_posted(db: Session, *, target_key: str, trace_id: str) -> bool:
    rows = db.scalars(
        select(EventLog).where(
            EventLog.event_type == GITHUB_TRACE_SUMMARY_EVENT,
            EventLog.trace_id == trace_id,
        )
    ).all()
    return any((row.payload_json or {}).get("target_key") == target_key for row in rows)


def _event_type(payload: dict[str, Any]) -> str | None:
    if payload.get("pull_request") and payload.get("comment"):
        return "pull_request_review_comment"
    if payload.get("issue") and payload.get("comment"):
        return "issue_comment"
    return None


def _comment_url(payload: dict[str, Any]) -> str | None:
    issue = payload.get("issue") or {}
    comments_url = issue.get("comments_url")
    if isinstance(comments_url, str):
        return comments_url
    pull_request = payload.get("pull_request") or {}
    issue_url = pull_request.get("issue_url")
    if isinstance(issue_url, str):
        return f"{issue_url}/comments"
    return None


def _target_key(payload: dict[str, Any]) -> str | None:
    issue = payload.get("issue") or {}
    if issue.get("id") is not None:
        return f"issue:{issue['id']}"
    pull_request = payload.get("pull_request") or {}
    if pull_request.get("id") is not None:
        return f"pull_request:{pull_request['id']}"
    return None


def _trace_for_identifier(db: Session, trace_identifier: str) -> Trace | None:
    return resolve_trace_identifier(db, trace_identifier)
