from __future__ import annotations

import os
import random
import time

import httpx
import reliai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

reliai.init(project=os.getenv("RELIAI_PROJECT", "reliai-demo"))

app = FastAPI(title="Reliai Demo Agent")


class DemoRequest(BaseModel):
    query: str
    hallucination: bool = False
    retrieval_failure: bool = False
    tool_timeout: bool = False
    use_tool: bool = True


def _retriever_url() -> str:
    return os.getenv("RETRIEVER_URL", "http://retriever:8011")


def _tools_url() -> str:
    return os.getenv("TOOLS_URL", "http://tools:8012")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run")
async def run_demo_request(payload: DemoRequest) -> dict[str, object]:
    started_at = time.perf_counter()
    with reliai.span("request", {"service_name": "agent", "route": "/run", "query": payload.query}) as request_span:
        retrieval_result = await _run_retrieval(payload, request_span)
        tool_result = await _run_tool(payload)
        completion = await _run_llm(payload, retrieval_result, tool_result)
        guardrail_result = _run_guardrail(payload, completion)

        request_span.set_trace_fields(
            model="demo-agent",
            provider="reliai-demo",
            input_text=payload.query,
            output_text=completion["answer"],
            latency_ms=int((time.perf_counter() - started_at) * 1000),
            retrieval={
                "retrieval_latency_ms": retrieval_result["latency_ms"],
                "source_count": len(retrieval_result["documents"]),
                "top_k": len(retrieval_result["documents"]),
                "query_text": payload.query,
                "retrieved_chunks": retrieval_result["documents"],
            },
        )
        request_span.set_metadata(
            {
                "service_name": "agent",
                "guardrail_triggered": guardrail_result["triggered"],
                "tool_used": payload.use_tool,
                "incident_type": guardrail_result["incident_type"],
            }
        )

        return {
            "answer": completion["answer"],
            "documents": retrieval_result["documents"],
            "tool_result": tool_result,
            "guardrail": guardrail_result,
        }


async def _run_retrieval(payload: DemoRequest, request_span: object) -> dict[str, object]:
    started_at = time.perf_counter()
    with reliai.span("retrieval", {"service_name": "retriever", "span_type": "retrieval"}) as span:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(f"{_retriever_url()}/search", json=payload.model_dump())
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="retrieval failed")
        body = response.json()
        span.set_trace_fields(
            model="vector-search",
            provider="reliai-demo",
            input_text=payload.query,
            output_text="\n".join(body["documents"]),
            latency_ms=body["latency_ms"],
            retrieval={
                "retrieval_latency_ms": body["latency_ms"],
                "source_count": len(body["documents"]),
                "top_k": len(body["documents"]),
                "query_text": payload.query,
                "retrieved_chunks": body["documents"],
            },
        )
        span.set_metadata({"service_name": "retriever", "document_count": len(body["documents"])})
        if hasattr(request_span, "set_metadata"):
            request_span.set_metadata({"retrieval_docs": len(body["documents"])})
        return {
            "documents": body["documents"],
            "latency_ms": int((time.perf_counter() - started_at) * 1000),
        }


async def _run_tool(payload: DemoRequest) -> dict[str, object] | None:
    if not payload.use_tool:
        return None
    with reliai.span("tool_execution", {"service_name": "tools", "span_type": "tool"}) as span:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.post(f"{_tools_url()}/execute", json=payload.model_dump())
        if response.status_code == 504:
            raise HTTPException(status_code=504, detail="tool timeout")
        response.raise_for_status()
        body = response.json()
        span.set_trace_fields(
            model="tool-router",
            provider="reliai-demo",
            input_text=payload.query,
            output_text=body["result"],
            latency_ms=body["latency_ms"],
        )
        span.set_metadata({"service_name": "tools", "tool_name": body["tool_name"]})
        return body


async def _run_llm(
    payload: DemoRequest,
    retrieval_result: dict[str, object],
    tool_result: dict[str, object] | None,
) -> dict[str, str]:
    with reliai.span("llm_response", {"service_name": "llm", "span_type": "llm"}) as span:
        answer = (
            "The incident was caused by stale retrieval context."
            if not payload.hallucination
            else "The payment service lives in the retriever cluster."
        )
        if tool_result:
            answer = f"{answer} Tool evidence: {tool_result['result']}"
        span.set_trace_fields(
            model="gpt-4.1-mini",
            provider="openai",
            input_text=payload.query,
            output_text=answer,
            latency_ms=random.randint(180, 420),
        )
        span.set_metadata(
            {
                "service_name": "llm",
                "retrieval_docs": len(retrieval_result["documents"]),
                "hallucination": payload.hallucination,
            }
        )
        return {"answer": answer}


def _run_guardrail(payload: DemoRequest, completion: dict[str, str]) -> dict[str, object]:
    triggered = payload.hallucination
    incident_type = "hallucination" if triggered else None
    with reliai.span("guardrail_check", {"service_name": "guardrail", "span_type": "guardrail"}) as span:
        action = "block" if triggered else "allow"
        span.set_trace_fields(
            model="guardrail-policy",
            provider="reliai",
            input_text=completion["answer"],
            output_text=action,
            latency_ms=random.randint(20, 80),
        )
        span.set_metadata(
            {
                "service_name": "guardrail",
                "triggered": triggered,
                "incident_type": incident_type,
            }
        )
        if triggered:
            reliai.get_default_client().guardrail_event(
                {
                    "trace_id": os.urandom(8).hex(),
                    "policy_id": "hallucination_guardrail",
                    "action": "block",
                    "provider_model": "gpt-4.1-mini",
                    "latency_ms": random.randint(20, 80),
                    "metadata": {
                        "service_name": "guardrail",
                        "incident_type": incident_type,
                        "recommendation": "Add hallucination guardrail to retriever prompt.",
                    },
                }
            )
    return {
        "triggered": triggered,
        "incident_type": incident_type,
        "recommended_action": (
            "Add hallucination guardrail to retriever prompt."
            if triggered
            else "Monitor retrieval quality."
        ),
    }
