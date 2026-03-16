# Reliai Agent Starter

Production-style agent starter for AI observability, LLM tracing, AI monitoring, LLM reliability, and agent tracing.

![Build](https://img.shields.io/badge/build-local-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-black)
![Stars](https://img.shields.io/badge/stars-GitHub-lightgrey)

---

## What is Reliai?

This starter shows how to trace agent steps, tool execution, retries, and guardrail checks in a production-style agent app.

---

## Quickstart (30 seconds)

```bash
git clone https://github.com/reliai/reliai-agent-starter
docker compose up
```

---

## What you see after installing Reliai

The starter turns agent traffic into:

- AI trace graphs
- retrieval spans
- guardrail triggers
- incident detection
- deployment regression detection

![Reliai control panel](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/control-panel.png)

---

## Example Output

![Reliai incident investigation](https://raw.githubusercontent.com/reliai/reliai/main/apps/web/public/screenshots/incident.png)

---

## Features

- agent reasoning loops
- tool calls
- retries
- guardrail checks

---

## Architecture

```mermaid
flowchart TD
    A["agent"] --> B["tools"]
    A --> C["memory"]
    A --> D["reliai-hooks"]
```

---

## Examples

See `agent/`, `tools/`, `memory/`, and `reliai-hooks/`.

---

## Documentation

See the platform repo and starter README.

---

## Community

See `CONTRIBUTING.md`.

---

## License

MIT
