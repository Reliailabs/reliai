# Reliai Examples

Small copy-paste examples for AI observability, LLM tracing, RAG debugging, AI monitoring, and agent tracing.

![Build](https://img.shields.io/badge/build-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-black)
![Stars](https://img.shields.io/badge/stars-GitHub-lightgrey)

---

## What is Reliai?

This repo contains small reference integrations developers can copy into their own AI systems.

---

## Quickstart (30 seconds)

```bash
cd examples/simple-llm
pip install -r requirements.txt
python app.py
```

---

## What you see after installing Reliai

Each example is designed to immediately surface:

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

- FastAPI RAG example
- LangGraph-style agent example
- evaluation pipeline example
- simple LLM tracing example

---

## Architecture

```mermaid
flowchart TD
    A["Example app"] --> B["Reliai SDK"]
    B --> C["Reliai platform"]
```

---

## Examples

- `examples/fastapi-rag`
- `examples/langgraph-agent`
- `examples/evaluation-pipeline`
- `examples/simple-llm`

---

## Documentation

See the README inside each example.

---

## Community

See `CONTRIBUTING.md`.

---

## License

MIT
