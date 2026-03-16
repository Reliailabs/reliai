# Reliai Python

Python instrumentation SDK for AI observability, LLM tracing, RAG debugging, AI monitoring, and LLM reliability.

![Build](https://img.shields.io/badge/build-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-black)
![Stars](https://img.shields.io/badge/stars-GitHub-lightgrey)

---

## What is Reliai?

Reliai helps developers trace AI systems, detect failures, and keep production AI systems reliable.

---

## Quickstart (30 seconds)

```bash
pip install reliai
```

```python
import reliai

reliai.init()

@reliai.trace
def retrieve_docs(query: str) -> list[str]:
    return [f"Document about {query}"]

@reliai.trace
async def call_llm(prompt: str) -> str:
    return f"Echo: {prompt}"
```

---

## What you see after installing Reliai

After installation, Reliai automatically gives you:

- AI trace graphs
- retrieval spans
- guardrail triggers
- incident detection
- deployment regression detection

![Reliai control panel](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/control-panel.png)

---

## Example Output

![Reliai trace graph](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/trace-graph.png)

---

## Features

- zero-config `@reliai.trace` decorator
- tracing and spans
- OpenAI instrumentation
- Anthropic instrumentation
- LangChain instrumentation
- FastAPI integration

---

## Architecture

```mermaid
flowchart TD
    A["Python app"] --> B["reliai-python"]
    B --> C["Reliai ingest API"]
    C --> D["Control panel"]
```

---

## Examples

- `examples/openai_basic.py`
- `examples/anthropic_basic.py`
- `examples/langchain_basic.py`
- `examples/fastapi_app.py`

---

## Documentation

See the core platform docs at `github.com/reliai/reliai`.

---

## Community

See `CONTRIBUTING.md`.

---

## License

MIT
