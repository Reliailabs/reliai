from __future__ import annotations

from typing import Any

from ..client import ReliaiClient


def detect_llamaindex(user_agent: str | None) -> bool:
    return bool(user_agent and "llamaindex" in user_agent.lower())


def instrument_llamaindex(client: ReliaiClient) -> None:
    for module_name in ("llama_index.core.query_engine", "llama_index.core.base.base_retriever"):
        try:
            module = __import__(module_name, fromlist=["*"])
        except Exception:
            continue
        for candidate in vars(module).values():
            if not isinstance(candidate, type):
                continue
            _patch_method(candidate, "query", client, "llm_call", {"span_type": "llm", "framework": "llamaindex"})
            _patch_method(candidate, "retrieve", client, "retrieval", {"span_type": "retrieval", "framework": "llamaindex"})


def _patch_method(cls: type[Any], method_name: str, client: ReliaiClient, span_name: str, metadata: dict[str, Any]) -> None:
    original = getattr(cls, method_name, None)
    if not callable(original) or getattr(original, "__reliai_patched__", False):
        return

    def wrapped(self: Any, *args: Any, **kwargs: Any):
        with client.span(span_name, dict(metadata)):
            return original(self, *args, **kwargs)

    setattr(wrapped, "__reliai_patched__", True)
    setattr(cls, method_name, wrapped)
