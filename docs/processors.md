# Reliai Processor Framework

The processor framework is the execution layer for Reliai event streams.

## Purpose

Processors let multiple independent services consume the same topic without pushing more logic into the ingest path.

Current default processors:

- `evaluation`
- `warehouse`
- `reliability_metrics`
- `regression`

All subscribe to the `trace_events` topic and react to `trace_ingested` events.

## Core Files

- `apps/api/app/processors/base_processor.py`
- `apps/api/app/processors/registry.py`
- `apps/api/app/processors/dispatcher.py`
- `apps/api/app/processors/runner.py`

## How To Build A Processor

1. Create a processor under `apps/api/app/processors/`.
2. Inherit from `BaseProcessor`.
3. Set a stable `name`.
4. Set the subscribed `topic`.
5. Implement `async def process(self, event)`.
6. Register it in `registry.py`.

Example shape:

```python
class ExampleProcessor(BaseProcessor):
    name = "example"
    topic = "trace_events"

    async def process(self, event):
        if event.event_type != "trace_ingested":
            return
        ...
```

## Subscriptions

Subscriptions are managed by the processor registry.

- One topic can have multiple processors.
- Dispatch is sequential per event.
- Processor failures are isolated and logged.
- One failing processor does not block the others for the same event.

## Configuration

Use `ENABLED_PROCESSORS` to turn processors on or off without code changes.

Example:

```env
ENABLED_PROCESSORS=evaluation,warehouse,reliability_metrics,regression
```

Worker wrappers can still run a single processor explicitly, but the shared runner is the primary routing path.

## Best Practices

- Keep processors idempotent.
- Treat evaluation as a prerequisite if downstream logic depends on it.
- Read the minimal data needed from Postgres.
- Keep topic payloads stable and explicit.
- Log failures with processor name, topic, and trace identifiers.
- Do not add synchronous API-path dependencies on processor execution.
