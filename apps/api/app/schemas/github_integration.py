from typing import Any

from app.schemas.common import APIModel


class GitHubCommentWebhookRead(APIModel):
    action: str | None = None
    comment: dict[str, Any] | None = None
    issue: dict[str, Any] | None = None
    pull_request: dict[str, Any] | None = None
    repository: dict[str, Any] | None = None
    installation: dict[str, Any] | None = None
    sender: dict[str, Any] | None = None


class GitHubWebhookProcessRead(APIModel):
    status: str
    posted_trace_ids: list[str] = []
