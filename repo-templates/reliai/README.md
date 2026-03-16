# Reliai

AI observability platform for tracing AI systems, incident detection, guardrails, and reliability analysis.

![Build](https://img.shields.io/badge/build-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-black)
![Stars](https://img.shields.io/badge/stars-GitHub-lightgrey)

---

## What is Reliai?

Reliai is an AI observability and AI monitoring platform for LLM tracing, RAG debugging, LLM reliability, and agent tracing.

---

## Quickstart (30 seconds)

```bash
docker compose up
```

Then open:

`http://localhost:3000`

---

## What you see after installing Reliai

Reliai automatically turns live traffic into an operator surface with:

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

- AI trace ingestion
- incident detection
- runtime guardrails
- trace graphs
- reliability analysis

---

## Architecture

```mermaid
flowchart TD
    A["SDK / AI app"] --> B["Reliai API"]
    B --> C["Control panel"]
    B --> D["Warehouse + analytics"]
```

---

## Examples

- `reliai-examples`
- `reliai-rag-starter`
- `reliai-agent-starter`

---

## Documentation

Platform docs live in `/docs`.

---

## Community

See `CONTRIBUTING.md`.

---

## License

MIT
