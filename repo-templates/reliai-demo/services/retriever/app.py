from __future__ import annotations

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

app = FastAPI(title="Reliai Demo Retriever")


class RetrievalRequest(BaseModel):
    query: str
    retrieval_failure: bool = False


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/search")
async def search(payload: RetrievalRequest) -> dict[str, object]:
    with reliai.span("retrieval_backend", {"service_name": "retriever", "component": "vector-index"}) as span:
        if payload.retrieval_failure:
            span.set_trace_fields(
                model="vector-search",
                provider="reliai-demo",
                input_text=payload.query,
                output_text="retrieval failure",
                latency_ms=random.randint(30, 90),
            )
            span.set_metadata({"service_name": "retriever", "failure": "index_unavailable"})
            raise HTTPException(status_code=503, detail="vector index unavailable")
        documents = [
            "Retriever prompt rollout at 14:07 UTC increased unsupported claims.",
            "Guardrail coverage is missing for unsupported product references.",
            "Recent deployment changed the retrieval temperature from 0.1 to 0.4.",
        ]
        span.set_trace_fields(
            model="vector-search",
            provider="reliai-demo",
            input_text=payload.query,
            output_text="\n".join(documents),
            latency_ms=random.randint(25, 70),
        )
        span.set_metadata({"service_name": "retriever", "document_count": len(documents)})
        return {"documents": documents, "latency_ms": random.randint(25, 70)}
