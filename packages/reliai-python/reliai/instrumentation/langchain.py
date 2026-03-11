from __future__ import annotations

from typing import Any

from ..client import ReliaiClient


def detect_langchain(user_agent: str | None) -> bool:
    return bool(user_agent and "langchain" in user_agent.lower())


def instrument_langchain(client: ReliaiClient) -> None:
    for module_name in ("langchain.chains.base", "langchain_core.retrievers", "langchain_core.tools"):
        try:
            module = __import__(module_name, fromlist=["*"])
        except Exception:
            continue
        for candidate in vars(module).values():
            if not isinstance(candidate, type):
                continue
            _patch_method(candidate, "run", client, "llm_call", {"span_type": "llm", "framework": "langchain"})
            _patch_method(candidate, "get_relevant_documents", client, "retrieval", {"span_type": "retrieval", "framework": "langchain"})
            _patch_method(candidate, "invoke", client, "tool_call", {"span_type": "tool", "framework": "langchain"})


def _patch_method(cls: type[Any], method_name: str, client: ReliaiClient, span_name: str, metadata: dict[str, Any]) -> None:
    original = getattr(cls, method_name, None)
    if not callable(original) or getattr(original, "__reliai_patched__", False):
        return

    def wrapped(self: Any, *args: Any, **kwargs: Any):
        extra = dict(metadata)
        tool_name = getattr(self, "name", None)
        if isinstance(tool_name, str) and tool_name:
            extra["tool_name"] = tool_name
        with client.span(span_name, extra):
            return original(self, *args, **kwargs)

    setattr(wrapped, "__reliai_patched__", True)
    setattr(cls, method_name, wrapped)
