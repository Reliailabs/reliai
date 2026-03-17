from __future__ import annotations

import asyncio
import os
import random
from itertools import cycle

import httpx
import reliai

reliai.init(project=os.getenv("RELIAI_PROJECT", "reliai-demo"))

AGENT_URL = os.getenv("AGENT_URL", "http://agent:8010")

RAG_QUERIES = [
    "Why did support answers start hallucinating refund policy details?",
    "Which deployment changed the retriever prompt this afternoon?",
    "Show the tool output for the current incident timeline.",
    "Did the latest rollout reduce citation quality for account answers?",
    "What changed in the retrieval pipeline after the 14:07 UTC deploy?",
    "Are guardrails catching unsupported product references correctly?",
]

TOOL_QUERIES = [
    "Look up the deployment history for the retriever service.",
    "Check the current guardrail policy version.",
    "Fetch the incident timeline for the support chatbot.",
    "Get the prompt diff between v2.1 and v2.2.",
]

LLM_QUERIES = [
    "Summarize all incidents from the past 24 hours.",
    "What is the current model error rate by provider?",
    "Compare output quality across the last three prompt versions.",
    "Which model has the highest guardrail trigger rate this week?",
    "Why are latency spikes happening on the embeddings endpoint?",
    "Which prompt version introduced the hallucination regression?",
]

_query_cycle = cycle(RAG_QUERIES + TOOL_QUERIES + LLM_QUERIES)


def _next_scenario() -> dict[str, object]:
    query = next(_query_cycle)
    r = random.random()
    # ~8% hallucination, ~2% retrieval failure, ~1.5% tool timeout
    return {
        "query": query,
        "hallucination": r < 0.08,
        "retrieval_failure": 0.08 <= r < 0.10,
        "tool_timeout": 0.10 <= r < 0.115,
        "use_tool": random.random() < 0.85,
    }


async def wait_for_agent() -> None:
    print("  waiting for agent service...", flush=True)
    async with httpx.AsyncClient(timeout=2.0) as client:
        for _ in range(120):
            try:
                r = await client.get(f"{AGENT_URL}/health")
                if r.status_code == 200:
                    print("  agent ready", flush=True)
                    return
            except Exception:
                pass
            await asyncio.sleep(1)
    raise RuntimeError("agent did not become healthy within 120s")


async def _send(client: httpx.AsyncClient, scenario: dict) -> None:
    with reliai.span("traffic_cycle", {"service_name": "traffic-generator"}) as span:
        try:
            r = await client.post(f"{AGENT_URL}/run", json=scenario)
            r.raise_for_status()
            body = r.json()
            span.set_trace_fields(
                model="traffic-generator",
                provider="reliai-demo",
                input_text=scenario["query"],
                output_text=body.get("answer"),
                latency_ms=random.randint(200, 500),
            )
            span.set_metadata(
                {"service_name": "traffic-generator", "status": "ok", **scenario}
            )
            # Guardrail retry: when a guardrail fires, immediately resend without
            # the hallucination flag to simulate the client retrying with a safer prompt.
            if body.get("guardrail", {}).get("triggered"):
                await asyncio.sleep(0.2)
                retry = {**scenario, "hallucination": False}
                retry_r = await client.post(f"{AGENT_URL}/run", json=retry)
                if retry_r.status_code == 200:
                    retry_body = retry_r.json()
                    with reliai.span(
                        "guardrail_retry", {"service_name": "traffic-generator"}
                    ) as rs:
                        rs.set_trace_fields(
                            model="traffic-generator",
                            provider="reliai-demo",
                            input_text=scenario["query"],
                            output_text=retry_body.get("answer"),
                            latency_ms=random.randint(200, 400),
                        )
                        rs.set_metadata(
                            {
                                "service_name": "traffic-generator",
                                "status": "guardrail_retry",
                                "retry": True,
                            }
                        )
        except Exception as exc:
            span.set_trace_fields(
                model="traffic-generator",
                provider="reliai-demo",
                input_text=scenario["query"],
                output_text=str(exc),
                latency_ms=random.randint(100, 250),
            )
            span.set_metadata(
                {"service_name": "traffic-generator", "status": "error", **scenario}
            )


async def _burst(client: httpx.AsyncClient, count: int = 15) -> None:
    """Send an initial burst of concurrent traces so the dashboard has data immediately."""
    print(f"  sending {count} initial traces...", flush=True)
    await asyncio.gather(
        *[_send(client, _next_scenario()) for _ in range(count)],
        return_exceptions=True,
    )
    print("  initial traces sent — dashboard should show data now.", flush=True)


async def main() -> None:
    print("", flush=True)
    print("Reliai demo running.", flush=True)
    print("Dashboard: http://localhost:3000", flush=True)
    print("", flush=True)

    await wait_for_agent()

    async with httpx.AsyncClient(timeout=5.0) as client:
        await _burst(client, count=15)
        while True:
            await _send(client, _next_scenario())
            await asyncio.sleep(random.uniform(1.0, 3.0))


if __name__ == "__main__":
    asyncio.run(main())
