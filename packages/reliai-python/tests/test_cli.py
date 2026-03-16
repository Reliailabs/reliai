from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

from reliai.cli.run import main


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("HOME", str(tmp_path))
    for key in [
        "RELIAI_AUTO_INSTRUMENT",
        "RELIAI_BOOTSTRAPPED",
        "RELIAI_API_KEY",
        "RELIAI_ENDPOINT",
        "RELIAI_PROJECT",
        "RELIAI_ENV",
        "PYTHON_ENV",
        "ENVIRONMENT",
    ]:
        monkeypatch.delenv(key, raising=False)
    yield


def test_reliai_run_requires_a_command(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([]) == 1
    assert "Usage: reliai-run <command> [args...]" in capsys.readouterr().err


def test_reliai_run_bootstraps_and_execs(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, list[str]]] = []

    def fake_execvp(program: str, argv: list[str]) -> None:
        calls.append((program, argv))
        raise SystemExit(0)

    monkeypatch.setattr(os, "execvp", fake_execvp)

    with pytest.raises(SystemExit, match="0"):
        main(["python", "app.py"])

    assert os.environ["RELIAI_BOOTSTRAPPED"] == "1"
    assert os.environ["RELIAI_AUTO_INSTRUMENT"] == "true"
    assert calls == [("python", ["python", "app.py"])]


def test_reliai_run_does_not_rebootstrap(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, list[str]]] = []
    monkeypatch.setenv("RELIAI_BOOTSTRAPPED", "1")
    monkeypatch.setenv("RELIAI_AUTO_INSTRUMENT", "false")

    def fake_execvp(program: str, argv: list[str]) -> None:
        calls.append((program, argv))
        raise SystemExit(0)

    monkeypatch.setattr(os, "execvp", fake_execvp)

    with pytest.raises(SystemExit, match="0"):
        main(["uvicorn", "app:app"])

    assert os.environ["RELIAI_AUTO_INSTRUMENT"] == "false"
    assert calls == [("uvicorn", ["uvicorn", "app:app"])]


def test_sitecustomize_skips_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RELIAI_AUTO_INSTRUMENT", raising=False)
    import reliai.sitecustomize as module

    init_calls: list[str] = []
    auto_calls: list[str] = []
    monkeypatch.setattr(sys.modules["reliai"], "init", lambda: init_calls.append("init"))
    monkeypatch.setattr(sys.modules["reliai"], "auto_instrument", lambda: auto_calls.append("auto"))

    module = importlib.reload(module)
    module._BOOTSTRAPPED = False
    module.bootstrap()

    assert init_calls == []
    assert auto_calls == []


def test_sitecustomize_bootstraps_once(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RELIAI_AUTO_INSTRUMENT", "true")
    import reliai.sitecustomize as module

    calls: list[str] = []
    monkeypatch.setattr(sys.modules["reliai"], "init", lambda: calls.append("init"))
    monkeypatch.setattr(sys.modules["reliai"], "auto_instrument", lambda: calls.append("auto"))

    module = importlib.reload(module)
    assert calls == ["init", "auto"]
    calls.clear()
    module.bootstrap()

    assert calls == []


def test_top_level_sitecustomize_shim_imports_bootstrap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RELIAI_AUTO_INSTRUMENT", "true")
    import reliai.sitecustomize as reliai_sitecustomize

    calls: list[str] = []

    def fake_bootstrap() -> None:
        calls.append("bootstrap")

    monkeypatch.setattr(reliai_sitecustomize, "bootstrap", fake_bootstrap)
    monkeypatch.delitem(sys.modules, "sitecustomize", raising=False)
    importlib.import_module("sitecustomize")

    assert calls == ["bootstrap"]
