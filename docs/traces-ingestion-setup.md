# Traces Ingestion Setup

This guide documents how to send traces from `/Users/robert/opentelemetry-demo` into Reliai.

## 1. Start the Reliai API

Make sure the Reliai API is running locally on port `8000` (Docker or local run is fine).

## 2. Install deps for `opentelemetry-demo`

The error:
```
ModuleNotFoundError: No module named 'opentelemetry'
```
means the demo environment is missing dependencies.

From `/Users/robert/opentelemetry-demo`:
```bash
python -m venv .venv
source .venv/bin/activate

# If requirements.txt exists, prefer it
pip install -r requirements.txt

# Otherwise, install minimal deps
pip install fastapi uvicorn opentelemetry-proto
```

## 3. Configure the Reliai adapter API key

Open `/Users/robert/opentelemetry-demo/reliai_adapter.py` and set your Reliai ingest key.

Example:
```python
API_KEY = "reliai_<your_key>"
```

Confirm the ingest URL in the adapter points to the local API:
```python
RELIAI_URL = "http://localhost:8000/api/v1/ingest/traces"
```

If the adapter runs inside a container, use:
```
http://reliai-api:8000/api/v1/ingest/traces
```

## 4. Start the adapter server

From `/Users/robert/opentelemetry-demo`:
```bash
uvicorn main:app --host 0.0.0.0 --port 9000
```

## 5. Run the OpenTelemetry demo

Start the demo in Docker and configure OTLP to send to the adapter:

If the demo runs in Docker:
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:9000/otlp/v1/traces
```

If the demo runs locally (not in Docker):
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:9000/otlp/v1/traces
```

## 6. Verify ingestion in Reliai

- Open Reliai and confirm the trace checklist Step 4 completes.
- Or verify via API:
```bash
curl -s "http://127.0.0.1:8000/api/v1/traces?limit=1"
```

## Troubleshooting

### Adapter fails to import `opentelemetry`
- Ensure the venv is activated.
- Install `opentelemetry-proto` (and `fastapi`, `uvicorn`).

### No traces arrive
- Confirm the demo exporter endpoint matches the adapter URL.
- Confirm the Reliai API key is correct.
- If using Docker, use `host.docker.internal` for the adapter.
