from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

from .client import get_default_client

T = TypeVar("T")


def _run_pipeline_step(name: str, span_type: str, fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    with get_default_client().span(name, {"span_type": span_type, **(metadata or {})}):
        return fn()


def retrieval(fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    return _run_pipeline_step("retrieval", "retrieval", fn, metadata)


def prompt_build(fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    return _run_pipeline_step("prompt_build", "prompt", fn, metadata)


def llm_call(fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    return _run_pipeline_step("llm_call", "llm", fn, metadata)


def tool_call(fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    return _run_pipeline_step("tool_call", "tool", fn, metadata)


def postprocess(fn: Callable[[], T], metadata: dict[str, Any] | None = None) -> T:
    return _run_pipeline_step("postprocess", "postprocess", fn, metadata)
