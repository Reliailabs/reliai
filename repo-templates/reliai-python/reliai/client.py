from __future__ import annotations

from contextlib import contextmanager
from typing import Any


class ReliaiSpan:
    def __init__(self, name: str) -> None:
        self.name = name

    def set_trace_fields(self, **fields: Any) -> None:
        pass

    def set_metadata(self, metadata: dict[str, Any]) -> None:
        pass

    def __enter__(self) -> "ReliaiSpan":
        return self

    def __exit__(self, *_: object) -> None:
        pass


class ReliaiClient:
    def __init__(self, project: str | None = None) -> None:
        self.project = project or "default"

    def span(self, name: str, metadata: dict | None = None) -> ReliaiSpan:
        return ReliaiSpan(name)
