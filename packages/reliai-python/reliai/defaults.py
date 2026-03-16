from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path

DEFAULT_CLOUD_ENDPOINT = "https://api.reliai.ai"
DEFAULT_LOCAL_ENDPOINT = "http://127.0.0.1:8000"
DEFAULT_PROJECT = "default"
CONFIG_DIR = ".reliai"
CONFIG_FILE = "config.json"


@dataclass(slots=True)
class ReliaiRuntimeConfig:
    api_key: str | None
    project: str
    environment: str
    endpoint: str
    organization_id: str | None
    local_project_id: str | None
    mode: str
    console_fallback: bool
    first_run: bool


def resolve_runtime_config(
    *,
    project: str | None = None,
    api_key: str | None = None,
    environment: str | None = None,
    endpoint: str | None = None,
    organization_id: str | None = None,
) -> ReliaiRuntimeConfig:
    resolved_api_key = api_key or os.getenv("RELIAI_API_KEY") or None
    resolved_environment = detect_environment(environment)
    resolved_project = project or os.getenv("RELIAI_PROJECT") or DEFAULT_PROJECT
    resolved_organization_id = organization_id or os.getenv("RELIAI_ORGANIZATION_ID")

    if resolved_api_key:
        resolved_endpoint = (endpoint or os.getenv("RELIAI_ENDPOINT") or DEFAULT_CLOUD_ENDPOINT).rstrip("/")
        return ReliaiRuntimeConfig(
            api_key=resolved_api_key,
            project=resolved_project,
            environment=resolved_environment,
            endpoint=resolved_endpoint,
            organization_id=resolved_organization_id,
            local_project_id=None,
            mode="cloud",
            console_fallback=False,
            first_run=False,
        )

    config_data, first_run = _load_or_create_local_config()
    local_project_id = str(config_data["project_id"])
    resolved_endpoint = (endpoint or os.getenv("RELIAI_ENDPOINT") or DEFAULT_LOCAL_ENDPOINT).rstrip("/")
    available = _endpoint_available(resolved_endpoint)

    return ReliaiRuntimeConfig(
        api_key=None,
        project=resolved_project,
        environment=resolved_environment,
        endpoint=resolved_endpoint,
        organization_id=resolved_organization_id,
        local_project_id=local_project_id,
        mode="development",
        console_fallback=not available,
        first_run=first_run,
    )


def detect_environment(explicit: str | None = None) -> str:
    return (
        explicit
        or os.getenv("RELIAI_ENV")
        or os.getenv("PYTHON_ENV")
        or os.getenv("ENVIRONMENT")
        or "development"
    )


def local_config_path() -> Path:
    return Path.home() / CONFIG_DIR / CONFIG_FILE


def _load_or_create_local_config() -> tuple[dict[str, str], bool]:
    path = local_config_path()
    if path.exists():
        try:
            data = json.loads(path.read_text())
            project_id = data.get("project_id")
            if isinstance(project_id, str) and project_id:
                return {"project_id": project_id}, False
        except Exception:
            pass

    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"project_id": str(uuid.uuid4())}
    path.write_text(json.dumps(data, indent=2, sort_keys=True))
    return data, True


def _endpoint_available(endpoint: str) -> bool:
    health_urls = [f"{endpoint}/api/v1/health", f"{endpoint}/health"]
    for url in health_urls:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if 200 <= getattr(response, "status", 0) < 300:
                    return True
        except (urllib.error.URLError, TimeoutError, ValueError):
            continue
        except Exception:
            continue
    return False
