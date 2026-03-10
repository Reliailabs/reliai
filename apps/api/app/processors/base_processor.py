from __future__ import annotations

from app.services.event_stream import EventMessage


class BaseProcessor:
    name: str = ""
    topic: str = ""
    max_retries: int = 1

    async def process(self, event: EventMessage) -> None:
        raise NotImplementedError
