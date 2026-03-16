from __future__ import annotations

import asyncio
import io
import json
import time
from contextlib import redirect_stderr
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request

import pytest

import reliai
from reliai.client import get_default_client, reset_default_client
from reliai.defaults import local_config_path


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


@pytest.fixture(autouse=True)
def _reset_sdk(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    reset_default_client()
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


def test_init_without_arguments_generates_local_config(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        client = reliai.init()

    assert client.project == "default"
    assert client.mode == "development"
    assert local_config_path().exists()
    assert json.loads(local_config_path().read_text())["project_id"]
    assert "Reliai initialized in development mode." in stderr.getvalue()
    assert "Dashboard:" in stderr.getvalue()
    assert "http://localhost:3000" in stderr.getvalue()


def test_environment_detection_precedence(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("PYTHON_ENV", "test")
    monkeypatch.setenv("RELIAI_ENV", "production")
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))

    client = reliai.init()

    assert client.environment == "production"


def test_explicit_arguments_override_environment_variables(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RELIAI_PROJECT", "env-project")
    monkeypatch.setenv("RELIAI_ENV", "env-production")
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))

    client = reliai.init(project="explicit-project", environment="explicit-test")

    assert client.project == "explicit-project"
    assert client.environment == "explicit-test"


def test_local_mode_uses_localhost_when_available(monkeypatch: pytest.MonkeyPatch):
    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    client = reliai.init()

    assert client.endpoint == "http://127.0.0.1:8000"
    assert client.console_fallback is False


def test_console_fallback_does_not_raise_when_localhost_unavailable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))
    reliai.init()

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        get_default_client().trace({"model": "demo-model", "success": True})
        get_default_client().flush()

    assert "RELIAI" in stderr.getvalue()


def test_trace_decorator_uses_default_client(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")

    @reliai.trace
    def run_query() -> str:
        return "ok"

    assert run_query() == "ok"
    get_default_client().flush()
    assert len(payloads) == 1
    assert payloads[0]["model_name"] == "span"


def test_trace_decorator_automatic_name_and_argument_capture(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")

    @reliai.trace
    def retrieve_docs(query: str, top_k: int, filters: dict[str, object], ignored: object) -> dict[str, object]:
        return {"query": query, "top_k": top_k, "nested": {"skip": True}}

    assert retrieve_docs("refund policy", 4, {"region": "us", "enabled": True, "nested": {"skip": True}}, object()) == {
        "query": "refund policy",
        "top_k": 4,
        "nested": {"skip": True},
    }
    get_default_client().flush()

    metadata = payloads[0]["metadata_json"]
    assert metadata["span_name"] == "test_init.test_trace_decorator_automatic_name_and_argument_capture.<locals>.retrieve_docs"
    assert metadata["function.module"] == "test_init"
    assert metadata["function.name"] == "test_trace_decorator_automatic_name_and_argument_capture.<locals>.retrieve_docs"
    assert metadata["function.args"] == {
        "query": "refund policy",
        "top_k": 4,
        "filters": {"region": "us", "enabled": True},
    }
    assert metadata["function.return_value"] == {"query": "refund policy", "top_k": 4}


def test_trace_decorator_skips_oversized_values(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")
    large_text = "x" * 1500

    @reliai.trace
    def summarize(text: str):
        return large_text

    assert summarize(large_text) == large_text
    get_default_client().flush()

    metadata = payloads[0]["metadata_json"]
    assert "function.args" not in metadata
    assert "function.return_value" not in metadata


def test_trace_decorator_supports_async_functions(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")

    @reliai.trace
    async def call_llm(prompt: str) -> str:
        return f"answer:{prompt}"

    assert asyncio.run(call_llm("hello")) == "answer:hello"
    get_default_client().flush()
    metadata = payloads[0]["metadata_json"]
    assert metadata["function.args"] == {"prompt": "hello"}
    assert metadata["function.return_value"] == "answer:hello"


def test_trace_decorator_captures_exceptions(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")

    @reliai.trace
    def explode(question: str) -> str:
        raise ValueError(f"bad question: {question}")

    with pytest.raises(ValueError, match="bad question: billing"):
        explode("billing")
    get_default_client().flush()

    assert payloads[0]["success"] is False
    assert payloads[0]["error_type"] == "ValueError"
    metadata = payloads[0]["metadata_json"]
    assert metadata["function.exception_type"] == "ValueError"
    assert metadata["function.exception_message"] == "bad question: billing"


def test_trace_decorator_allows_manual_name_override(monkeypatch: pytest.MonkeyPatch):
    payloads: list[dict[str, object]] = []

    def fake_urlopen(url, timeout=0):  # noqa: ARG001
        if isinstance(url, str) and url.endswith("/api/v1/health"):
            return _FakeResponse(200)
        if isinstance(url, Request):
            payloads.append(json.loads(url.data.decode("utf-8")))
        return _FakeResponse(200, {"accepted": True})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    reliai.init(project="demo")

    @reliai.trace("custom_span_name")
    def answer() -> str:
        return "ok"

    assert answer() == "ok"
    get_default_client().flush()
    assert payloads[0]["metadata_json"]["span_name"] == "custom_span_name"


def test_trace_url_defaults_to_canonical_host(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("RELIAI_DASHBOARD_URL", raising=False)
    assert reliai.trace_url("abc123") == "https://app.reliai.dev/traces/abc123"


def test_trace_url_respects_dashboard_override(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RELIAI_DASHBOARD_URL", "https://ops.example.com")
    assert reliai.trace_url("abc123") == "https://ops.example.com/traces/abc123"


def test_error_spans_print_investigation_link(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))
    monkeypatch.setenv("RELIAI_PRINT_TRACE_LINKS", "true")
    reliai.init(project="demo")

    @reliai.trace
    def explode() -> None:
        raise RuntimeError("boom")

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        with pytest.raises(RuntimeError, match="boom"):
            explode()
        get_default_client().flush()

    assert "Reliai trace captured" in stderr.getvalue()
    assert "Investigate:" in stderr.getvalue()
    assert "https://app.reliai.dev/traces/" in stderr.getvalue()


def test_slow_spans_print_investigation_link(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))
    monkeypatch.setenv("RELIAI_PRINT_TRACE_LINKS", "true")
    monkeypatch.setenv("RELIAI_SLOW_TRACE_MS", "0")
    reliai.init(project="demo")

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        with reliai.span("slow-span"):
            time.sleep(0.01)
        get_default_client().flush()

    assert "Reliai trace captured" in stderr.getvalue()
    assert "Investigate:" in stderr.getvalue()


def test_guardrail_retry_prints_trace_link(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))
    monkeypatch.setenv("RELIAI_PRINT_TRACE_LINKS", "true")
    reliai.init(project="demo")

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        with reliai.span("retry-span", {"guardrail_retry": True}):
            pass
        get_default_client().flush()

    assert "Guardrail retry detected" in stderr.getvalue()
    assert "Trace:" in stderr.getvalue()


def test_trace_link_printing_can_be_disabled(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(URLError("offline")))
    monkeypatch.setenv("RELIAI_PRINT_TRACE_LINKS", "false")
    monkeypatch.setenv("RELIAI_SLOW_TRACE_MS", "0")
    reliai.init(project="demo")

    stderr = io.StringIO()
    with redirect_stderr(stderr):
        with reliai.span("slow-span"):
            pass
        get_default_client().flush()

    assert "Investigate:" not in stderr.getvalue()
