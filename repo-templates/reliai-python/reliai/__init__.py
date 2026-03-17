from .client import ReliaiClient
from .tracing import trace

__version__ = "0.1.0"

_default_client: ReliaiClient | None = None


def init(
    project: str | None = None,
    api_key: str | None = None,
    environment: str | None = None,
) -> ReliaiClient:
    global _default_client
    _default_client = ReliaiClient(project=project or "default")
    return _default_client


def span(name: str, metadata: dict | None = None):
    if _default_client is None:
        init()
    return _default_client.span(name, metadata)  # type: ignore[union-attr]


def auto_instrument() -> None:
    """Auto-instrument supported frameworks (FastAPI, OpenAI, Anthropic, LangChain)."""


__all__ = [
    "ReliaiClient",
    "auto_instrument",
    "init",
    "span",
    "trace",
    "__version__",
]
