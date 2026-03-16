from __future__ import annotations

import asyncio
import json
import sys
import types
from pathlib import Path
from urllib.request import Request

import pytest

import reliai
from reliai.auto import enable_auto_instrumentation
from reliai.client import get_default_client, reset_default_client
from reliai.instrumentation import _reset_instrumentation_registry, auto_instrument


class _FakeResponse:
    def __init__(self, status: int, payload: dict | None = None):
        self.status = status
        self._payload = payload or {"ok": True}

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None


class _FakeRequest:
    def __init__(self, method: str, path: str):
        self.method = method
        self.url = types.SimpleNamespace(path=path)


class _FakeHTTPException(Exception):
    def __init__(self, status_code: int):
        super().__init__(f"http {status_code}")
        self.status_code = status_code


def _capture_payloads(monkeypatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    return payloads


def _install_fastapi_stub(monkeypatch):
    for name in ["fastapi", "fastapi.routing"]:
        monkeypatch.delitem(sys.modules, name, raising=False)

    routing = types.ModuleType("fastapi.routing")

    def request_response(handler):
        return handler

    class APIRoute:
        def __init__(self, path: str, endpoint, methods: list[str] | None = None):
            self.path = path
            self.endpoint = endpoint
            self.methods = set(methods or ["GET"])
            self.app = request_response(self.get_route_handler())

        def get_route_handler(self):
            if asyncio.iscoroutinefunction(self.endpoint):
                return self.endpoint

            async def handler(request):
                return self.endpoint(request)

            return handler

    class APIRouter:
        def __init__(self):
            self.routes = []

        def add_api_route(self, path, endpoint, methods=None):
            self.routes.append(APIRoute(path, endpoint, methods=methods or ["GET"]))

    class FastAPI:
        def __init__(self):
            self.router = APIRouter()

        def get(self, path):
            def decorator(fn):
                self.router.add_api_route(path, fn, methods=["GET"])
                return fn

            return decorator

    routing.APIRoute = APIRoute
    routing.APIRouter = APIRouter
    routing.request_response = request_response

    fastapi = types.ModuleType("fastapi")
    fastapi.FastAPI = FastAPI
    fastapi.HTTPException = _FakeHTTPException
    fastapi.routing = routing

    monkeypatch.setitem(sys.modules, "fastapi", fastapi)
    monkeypatch.setitem(sys.modules, "fastapi.routing", routing)
    return fastapi


def _install_openai_stub(monkeypatch):
    monkeypatch.delitem(sys.modules, "openai", raising=False)

    class ChatCompletion:
        @staticmethod
        def create(**kwargs):
            return {
                "model": kwargs.get("model"),
                "choices": [{"message": {"content": "chat response"}}],
                "usage": {"prompt_tokens": 7, "completion_tokens": 9},
            }

    class _Responses:
        @staticmethod
        def create(**kwargs):
            return {
                "model": kwargs.get("model"),
                "output_text": "response output",
                "usage": {"input_tokens": 5, "output_tokens": 8},
            }

    openai = types.ModuleType("openai")
    openai.ChatCompletion = ChatCompletion
    openai.responses = _Responses()
    monkeypatch.setitem(sys.modules, "openai", openai)
    return openai


def _install_langchain_stub(monkeypatch):
    for name in [
        "langchain",
        "langchain.chains",
        "langchain.chains.base",
        "langchain.llms",
        "langchain.llms.base",
        "langchain.tools",
        "langchain.tools.base",
    ]:
        monkeypatch.delitem(sys.modules, name, raising=False)

    langchain = types.ModuleType("langchain")
    chains = types.ModuleType("langchain.chains")
    chains_base = types.ModuleType("langchain.chains.base")
    llms = types.ModuleType("langchain.llms")
    llms_base = types.ModuleType("langchain.llms.base")
    tools = types.ModuleType("langchain.tools")
    tools_base = types.ModuleType("langchain.tools.base")

    class LLM:
        def invoke(self, prompt):
            return f"llm:{prompt}"

    class Tool:
        name = "search"

        def run(self, value):
            return f"tool:{value}"

    class Chain:
        def __init__(self, llm, tool):
            self.llm = llm
            self.tool = tool

        def invoke(self, value):
            tool_result = self.tool.run(value)
            llm_result = self.llm.invoke(value)
            return {"tool": tool_result, "llm": llm_result}

    chains_base.Chain = Chain
    llms_base.LLM = LLM
    tools_base.Tool = Tool

    monkeypatch.setitem(sys.modules, "langchain", langchain)
    monkeypatch.setitem(sys.modules, "langchain.chains", chains)
    monkeypatch.setitem(sys.modules, "langchain.chains.base", chains_base)
    monkeypatch.setitem(sys.modules, "langchain.llms", llms)
    monkeypatch.setitem(sys.modules, "langchain.llms.base", llms_base)
    monkeypatch.setitem(sys.modules, "langchain.tools", tools)
    monkeypatch.setitem(sys.modules, "langchain.tools.base", tools_base)
    return Chain, LLM, Tool


@pytest.fixture(autouse=True)
def _reset_sdk(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    reset_default_client()
    _reset_instrumentation_registry()
    monkeypatch.setenv("HOME", str(tmp_path))
    for key in [
        "RELIAI_API_KEY",
        "RELIAI_ENDPOINT",
        "RELIAI_PROJECT",
        "RELIAI_ENV",
        "PYTHON_ENV",
        "ENVIRONMENT",
        "RELIAI_ORGANIZATION_ID",
        "RELIAI_ENVIRONMENT",
    ]:
        monkeypatch.delenv(key, raising=False)
    yield
    reset_default_client()
    _reset_instrumentation_registry()


def test_auto_instrument_skips_missing_frameworks(monkeypatch):
    _capture_payloads(monkeypatch)
    reliai.init(project="demo")

    summary = auto_instrument()

    assert "openai" in summary["skipped"]
    assert "langchain" in summary["skipped"]
    assert "sqlalchemy" in summary["disabled"]


def test_auto_instrument_fastapi_records_request_metadata(monkeypatch):
    payloads = _capture_payloads(monkeypatch)
    fastapi = _install_fastapi_stub(monkeypatch)
    reliai.init(project="demo")
    app = fastapi.FastAPI()

    @app.get("/health")
    def health(_request):
        return types.SimpleNamespace(status_code=204)

    summary = auto_instrument(openai=False, langchain=False)
    route = app.router.routes[0]
    response = asyncio.run(route.app(_FakeRequest("GET", "/health")))
    get_default_client().flush()

    assert summary["patched"] == ["fastapi"]
    assert response.status_code == 204
    metadata = payloads[0]["metadata_json"]
    assert metadata["framework"] == "fastapi"
    assert metadata["http.method"] == "GET"
    assert metadata["http.path"] == "/health"
    assert metadata["http.status_code"] == 204


def test_auto_instrument_patches_openai_only_once(monkeypatch):
    payloads = _capture_payloads(monkeypatch)
    openai = _install_openai_stub(monkeypatch)
    reliai.init(project="demo")

    original = openai.ChatCompletion.create
    first_summary = auto_instrument(fastapi=False, langchain=False)
    first_patched = openai.ChatCompletion.create
    second_summary = auto_instrument(fastapi=False, langchain=False)

    assert original is not first_patched
    assert first_patched is openai.ChatCompletion.create
    assert first_summary["patched"] == ["openai"]
    assert second_summary["patched"] == ["openai"]

    result = openai.ChatCompletion.create(model="gpt-4.1-mini", messages=[{"role": "user", "content": "hi"}])
    get_default_client().flush()
    assert result["usage"]["prompt_tokens"] == 7
    metadata = payloads[0]["metadata_json"]
    assert metadata["framework"] == "openai"
    assert metadata["openai.model"] == "gpt-4.1-mini"
    assert payloads[0]["prompt_tokens"] == 7
    assert payloads[0]["completion_tokens"] == 9


def test_disabling_openai_prevents_patching(monkeypatch):
    _capture_payloads(monkeypatch)
    openai = _install_openai_stub(monkeypatch)
    reliai.init(project="demo")
    original = openai.ChatCompletion.create

    summary = auto_instrument(fastapi=False, openai=False, langchain=False)

    assert openai.ChatCompletion.create is original
    assert "openai" in summary["disabled"]


def test_auto_instrument_langchain_creates_nested_spans(monkeypatch):
    payloads = _capture_payloads(monkeypatch)
    Chain, LLM, Tool = _install_langchain_stub(monkeypatch)
    reliai.init(project="demo")

    summary = auto_instrument(fastapi=False, openai=False)
    chain = Chain(LLM(), Tool())
    result = chain.invoke("refund")
    get_default_client().flush()

    assert summary["patched"] == ["langchain"]
    assert result["tool"] == "tool:refund"
    span_names = [payload["metadata_json"]["span_name"] for payload in payloads]
    assert span_names == ["langchain.tool.run", "langchain.llm.invoke", "langchain.chain.invoke"]


def test_enable_auto_instrumentation_compatibility_path(monkeypatch):
    _capture_payloads(monkeypatch)
    _install_openai_stub(monkeypatch)
    reliai.init(project="demo")

    client = enable_auto_instrumentation()

    assert client is get_default_client()
