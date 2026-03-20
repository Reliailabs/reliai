from __future__ import annotations

import asyncio
import os
import random
import time

import reliai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

def _load_api_key() -> None:
    if os.getenv("RELIAI_API_KEY"):
        return
    path = os.getenv("RELIAI_API_KEY_PATH", "/shared/api_key")
    for _ in range(60):
        if os.path.exists(path):
            key = open(path).read().strip()
            if key:
                os.environ["RELIAI_API_KEY"] = key
                return
        time.sleep(1)

_load_api_key()
reliai.init(
    project=os.getenv("RELIAI_PROJECT", "reliai-demo"),
    environment=os.getenv("RELIAI_ENV", "prod"),
)

app = FastAPI(title="Reliai Demo Tools")


class ToolRequest(BaseModel):
    query: str
    tool_timeout: bool = False


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/execute")
async def execute(payload: ToolRequest) -> dict[str, object]:
    with reliai.span("tool_backend", {"service_name": "tools", "component": "status-api"}) as span:
        if payload.tool_timeout:
            await asyncio.sleep(1.5)
            span.set_trace_fields(
                model="status-api",
                provider="reliai-demo",
                input_text=payload.query,
                output_text="timeout",
                latency_ms=1500,
            )
            span.set_metadata({"service_name": "tools", "failure": "timeout"})
            raise HTTPException(status_code=504, detail="tool timeout")
        result = "Deployment timeline confirms the retriever prompt changed in the last release."
        latency_ms = random.randint(40, 140)
        span.set_trace_fields(
            model="status-api",
            provider="reliai-demo",
            input_text=payload.query,
            output_text=result,
            latency_ms=latency_ms,
        )
        span.set_metadata({"service_name": "tools", "tool_name": "deployment_lookup"})
        return {"tool_name": "deployment_lookup", "result": result, "latency_ms": latency_ms}
