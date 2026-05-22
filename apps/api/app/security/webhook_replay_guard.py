from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class _ReplayEntry:
    expires_at: int


class ReplayGuard:
    def __init__(self) -> None:
        self._entries: dict[str, _ReplayEntry] = {}

    def _gc(self, *, now_seconds: int) -> None:
        expired_keys = [key for key, entry in self._entries.items() if entry.expires_at <= now_seconds]
        for key in expired_keys:
            self._entries.pop(key, None)

    def register(self, *, key: str, ttl_seconds: int, now_seconds: int | None = None) -> bool:
        now = int(time.time()) if now_seconds is None else now_seconds
        self._gc(now_seconds=now)
        if key in self._entries:
            return False
        self._entries[key] = _ReplayEntry(expires_at=now + max(1, ttl_seconds))
        return True


invite_delivery_replay_guard = ReplayGuard()
