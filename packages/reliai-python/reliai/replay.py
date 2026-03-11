from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .client import ReliaiClient, get_default_client


@dataclass(slots=True)
class ReliaiReplayPipeline:
    payload: dict[str, Any]

    def run(self) -> dict[str, Any]:
        return self.payload


def replay(trace_id: str, client: ReliaiClient | None = None) -> ReliaiReplayPipeline:
    active_client = client or get_default_client()
    payload = active_client.request_json(f"/api/v1/traces/{trace_id}/replay")
    return ReliaiReplayPipeline(payload=payload)
