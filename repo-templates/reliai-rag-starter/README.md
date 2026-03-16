# Reliai RAG Starter

Production-style RAG starter for AI observability, LLM tracing, RAG debugging, AI monitoring, and LLM reliability.

![Build](https://img.shields.io/badge/build-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-black)
![Stars](https://img.shields.io/badge/stars-GitHub-lightgrey)

---

## What is Reliai?

This starter shows how to build a traced RAG pipeline with retrieval, context assembly, LLM calls, and reliability hooks.

---

## Quickstart (30 seconds)

```bash
git clone https://github.com/reliai/reliai-rag-starter
docker compose up
```

---

## What you see after installing Reliai

The starter automatically exposes:

- AI trace graphs
- retrieval spans
- guardrail triggers
- incident detection
- deployment regression detection

![Reliai control panel](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/control-panel.png)

---

## Example Output

![Reliai control panel](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/control-panel.png)

---

## Features

- retrieval pipeline
- vector-db boundary
- Reliai instrumentation
- RAG debugging visibility

---

## Architecture

```mermaid
flowchart TD
    A["query"] --> B["retriever"]
    B --> C["context"]
    C --> D["LLM"]
    D --> E["response"]
    B --> F["Reliai tracing"]
    D --> F
```

---

## Examples

See `app/`, `retriever/`, `vector-db/`, and `reliai-instrumentation/`.

---

## Documentation

See the platform repo and starter README.

---

## Community

See `CONTRIBUTING.md`.

---

## License

MIT
