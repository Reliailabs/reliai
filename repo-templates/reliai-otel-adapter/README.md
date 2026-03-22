# Reliai OTEL Adapter

![License](https://img.shields.io/badge/license-MIT-blue)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-compatible-green)
![Demo](https://img.shields.io/badge/demo-1--command-black)

> Plug Reliai into any OpenTelemetry system — no SDK changes required.

Send OpenTelemetry traces to Reliai in 60 seconds.

![Reliai trace graph](./assets/trace-example.png)

Plug Reliai into any OTEL system — no SDK changes required.

## Run in 60 seconds

```bash
git clone https://github.com/reliailabs/reliai-otel-adapter
cd reliai-otel-adapter

export RELIAI_API_KEY=your_key_here

docker compose -f docker/docker-compose.yaml up --build
```

Open http://localhost:3000

## What you get

- OTEL traces flowing into Reliai
- Full trace graph + incident detection
- No instrumentation changes required

![Reliai incident view](./assets/incident.png)

## How it works

OTEL services → Collector → Adapter → Reliai

## Supported systems

- OpenTelemetry demo
- Any OTLP-compatible service

## Why this exists

Most observability tools require custom SDKs. Reliai works directly with OpenTelemetry — the industry standard.

No lock-in. No rewrites. Just plug in and observe.

## OpenTelemetry demo example

See [examples/otel-demo](./examples/otel-demo/README.md) for a compose override you can drop into the OpenTelemetry demo.

## Configuration

- `RELIAI_API_URL` (default: `http://host.docker.internal:8000`)
- `RELIAI_API_KEY` (required)
