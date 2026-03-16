from __future__ import annotations

from typing import Any

from ..client import ReliaiClient, get_default_client
from .fastapi import instrument_fastapi
from .langchain import instrument_langchain
from .openai import instrument_openai

_instrumented_frameworks: set[str] = set()


def auto_instrument(
    *,
    fastapi: bool = True,
    openai: bool = True,
    langchain: bool = True,
    sqlalchemy: bool = False,
    client: ReliaiClient | None = None,
) -> dict[str, list[str]]:
    active_client = client or get_default_client()
    summary = {"patched": [], "skipped": [], "disabled": []}

    if fastapi:
        _patch_framework("fastapi", instrument_fastapi, active_client, summary)
    else:
        summary["disabled"].append("fastapi")

    if openai:
        _patch_framework("openai", instrument_openai, active_client, summary)
    else:
        summary["disabled"].append("openai")

    if langchain:
        _patch_framework("langchain", instrument_langchain, active_client, summary)
    else:
        summary["disabled"].append("langchain")

    if sqlalchemy:
        summary["skipped"].append("sqlalchemy")
    else:
        summary["disabled"].append("sqlalchemy")

    return summary


def _patch_framework(
    name: str,
    patcher: Any,
    client: ReliaiClient,
    summary: dict[str, list[str]],
) -> None:
    if name in _instrumented_frameworks:
        summary["patched"].append(name)
        return
    if patcher(client):
        _instrumented_frameworks.add(name)
        summary["patched"].append(name)
        return
    summary["skipped"].append(name)


def _reset_instrumentation_registry() -> None:
    _instrumented_frameworks.clear()


__all__ = ["auto_instrument"]
