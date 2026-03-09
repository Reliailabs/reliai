# Reliai

Reliai is an AI reliability platform for LLM, RAG, and agentic applications. The current foundation covers tenant setup, project API keys, trace ingestion, a trace explorer, retrieval span persistence, and a first structured-output evaluation scaffold.

## Local setup

1. Copy `.env.example` to `.env`.
2. Install dependencies and create the Python virtualenv:

```bash
make install
```

3. Start local Postgres and Redis:

```bash
make db-up
```

4. Apply database migrations:

```bash
make db-migrate
```

5. Seed a local organization, project, and API key:

```bash
make seed
```

6. Run the API:

```bash
make dev
```

7. Run the web app in another terminal:

```bash
pnpm --filter web dev
```

8. Run the worker in another terminal when you want evaluation jobs processed from Redis:

```bash
make worker
```

The API runs on `http://localhost:8000`. The web shell runs on `http://localhost:3000`. The RQ worker consumes the `default` queue.

## Core commands

- `make test` runs the API test suite.
- `make lint` runs Ruff and Next.js linting.
- `make format` formats Python and web files.
- `make dev` runs the FastAPI service only.
- `make worker` runs the RQ worker for evaluation jobs.
- `curl http://localhost:8000/health` verifies the API is up.
- `curl http://localhost:3000` verifies the web shell is up.

## First ingest check

After `make seed`, use the printed API key with:

```bash
curl -X POST http://localhost:8000/api/v1/ingest/traces \
  -H "x-api-key: reliai_..." \
  -H "content-type: application/json" \
  -d '{
    "timestamp": "2026-03-09T12:00:00Z",
    "request_id": "req_123",
    "model_name": "gpt-4.1-mini",
    "success": true
  }'
```

## Milestone 1 endpoints

- `GET /health`
- `GET /api/v1/health`
- `POST /api/v1/organizations`
- `GET /api/v1/organizations/{organization_id}`
- `POST /api/v1/organizations/{organization_id}/projects`
- `GET /api/v1/projects/{project_id}`
- `POST /api/v1/projects/{project_id}/api-keys`
- `POST /api/v1/ingest/traces`

## Trace explorer endpoints

- `GET /api/v1/traces`
- `GET /api/v1/traces/{trace_id}`
