from __future__ import annotations

from app.services.event_stream import EventMessage


class BaseProcessor:
    name: str = ""
    topic: str = ""
    processor_type: str = "internal"
    version: str = "1.0.0"
    max_retries: int = 1

    async def process(self, event: EventMessage) -> None:
        raise NotImplementedError
