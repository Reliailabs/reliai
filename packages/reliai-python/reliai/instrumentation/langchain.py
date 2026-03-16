from __future__ import annotations

from inspect import iscoroutinefunction
from typing import Any

from ..client import ReliaiClient


def detect_langchain(user_agent: str | None) -> bool:
    return bool(user_agent and "langchain" in user_agent.lower())


def instrument_langchain(client: ReliaiClient) -> bool:
    patched = False
    patched |= _patch_target("langchain.chains.base", "Chain", "invoke", client, "langchain.chain.invoke", {"framework": "langchain", "component": "chain"})
    patched |= _patch_target("langchain.llms.base", "LLM", "invoke", client, "langchain.llm.invoke", {"framework": "langchain", "component": "llm"})
    patched |= _patch_target("langchain_core.language_models.llms", "LLM", "invoke", client, "langchain.llm.invoke", {"framework": "langchain", "component": "llm"})
    patched |= _patch_target("langchain.tools.base", "Tool", "run", client, "langchain.tool.run", {"framework": "langchain", "component": "tool"})
    patched |= _patch_target("langchain_core.tools", "Tool", "run", client, "langchain.tool.run", {"framework": "langchain", "component": "tool"})
    return patched


def _patch_target(
    module_name: str,
    class_name: str,
    method_name: str,
    client: ReliaiClient,
    span_name: str,
    metadata: dict[str, Any],
) -> bool:
    try:
        module = __import__(module_name, fromlist=[class_name])
    except Exception:
        return False
    candidate = getattr(module, class_name, None)
    if not isinstance(candidate, type):
        return False
    return _patch_method(candidate, method_name, client, span_name, metadata)


def _patch_method(cls: type[Any], method_name: str, client: ReliaiClient, span_name: str, metadata: dict[str, Any]) -> bool:
    original = getattr(cls, method_name, None)
    if not callable(original) or getattr(original, "__reliai_patched__", False):
        return False

    if iscoroutinefunction(original):

        async def wrapped(self: Any, *args: Any, **kwargs: Any):
            extra = _extra_metadata(self, metadata)
            with client.span(span_name, extra):
                return await original(self, *args, **kwargs)

    else:

        def wrapped(self: Any, *args: Any, **kwargs: Any):
            extra = _extra_metadata(self, metadata)
            with client.span(span_name, extra):
                return original(self, *args, **kwargs)

    setattr(wrapped, "__reliai_patched__", True)
    setattr(cls, method_name, wrapped)
    return True


def _extra_metadata(instance: Any, metadata: dict[str, Any]) -> dict[str, Any]:
    extra = dict(metadata)
    tool_name = getattr(instance, "name", None)
    if isinstance(tool_name, str) and tool_name:
        extra["tool_name"] = tool_name
    return extra
