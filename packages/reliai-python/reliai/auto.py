from __future__ import annotations

from .client import ReliaiClient, get_default_client
from .instrumentation import auto_instrument


def enable_auto_instrumentation(client: ReliaiClient | None = None) -> ReliaiClient:
    active_client = client or get_default_client()
    auto_instrument(client=active_client)
    return active_client
