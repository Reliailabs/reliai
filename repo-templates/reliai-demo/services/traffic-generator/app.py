from __future__ import annotations

import asyncio
import os
import random
from itertools import cycle

import httpx
import reliai

reliai.init(project=os.getenv("RELIAI_PROJECT", "reliai-demo"))

AGENT_URL = os.getenv("AGENT_URL", "http://agent:8010")
QUERIES = cycle(
    [
        "Why did support answers start hallucinating refund policy details?",
        "Which deployment changed the retriever prompt this afternoon?",
        "Show the tool output for the current incident timeline.",
        "Did the latest rollout reduce citation quality for account answers?",
    ]
)


async def wait_for_agent() -> None:
    async with httpx.AsyncClient(timeout=2.0) as client:
        while True:
            try:
                response = await client.get(f"{AGENT_URL}/health")
                if response.status_code == 200:
                    return
            except Exception:
                pass
            await asyncio.sleep(1)


async def simulate_agent_request(client: httpx.AsyncClient) -> None:
    query = next(QUERIES)
    scenario = {
        "query": query,
        "hallucination": random.random() < 0.05,
        "retrieval_failure": random.random() < 0.02,
        "tool_timeout": random.random() < 0.01,
        "use_tool": random.random() < 0.85,
    }
    with reliai.span("traffic_cycle", {"service_name": "traffic-generator"}) as span:
        try:
            response = await client.post(f"{AGENT_URL}/run", json=scenario)
            response.raise_for_status()
            body = response.json()
            span.set_trace_fields(
                model="traffic-generator",
                provider="reliai-demo",
                input_text=query,
                output_text=body.get("answer"),
                latency_ms=random.randint(200, 500),
            )
            span.set_metadata({"service_name": "traffic-generator", "status": "ok", **scenario})
        except Exception as exc:
            span.set_trace_fields(
                model="traffic-generator",
                provider="reliai-demo",
                input_text=query,
                output_text=str(exc),
                latency_ms=random.randint(100, 250),
            )
            span.set_metadata({"service_name": "traffic-generator", "status": "error", **scenario})


async def main() -> None:
    await wait_for_agent()
    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            await simulate_agent_request(client)
            await asyncio.sleep(random.uniform(1.0, 3.0))


if __name__ == "__main__":
    asyncio.run(main())
