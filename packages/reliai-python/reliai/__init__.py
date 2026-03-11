from .client import ReliaiClient, get_default_client
from .guardrails import (
    GuardrailAction,
    ReliaiGuardrailEvent,
    cost_budget,
    latency_retry,
    structured_output,
)
from .pipeline import llm_call, postprocess, prompt_build, retrieval, tool_call
from .replay import ReliaiReplayPipeline, replay
from .tracing import ReliaiRetrievalSpan, ReliaiTraceEvent


def span(name: str, metadata: dict | None = None):
    return get_default_client().span(name, metadata)

__all__ = [
    "GuardrailAction",
    "ReliaiClient",
    "ReliaiGuardrailEvent",
    "ReliaiRetrievalSpan",
    "ReliaiReplayPipeline",
    "ReliaiTraceEvent",
    "cost_budget",
    "latency_retry",
    "llm_call",
    "postprocess",
    "prompt_build",
    "replay",
    "retrieval",
    "span",
    "structured_output",
    "tool_call",
]
