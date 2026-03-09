# Reliai

Reliai is an AI reliability platform for LLM, RAG, and agentic applications. The current foundation covers operator auth, tenant-scoped org/project access, project API keys, trace ingestion, a trace explorer, retrieval span persistence, and a first structured-output evaluation scaffold.

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

The seed prints a local operator account:

- `owner@acme.test`
- `reliai-dev-password`

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

## Auth approach

Milestone 3 uses a lean first-party operator auth scaffold:

- `operator_users` stores operator email and password hash.
- `operator_sessions` stores opaque session token hashes plus expiry and revocation timestamps.
- operator endpoints require `Authorization: Bearer <session_token>`.
- trace ingest remains project-key authenticated and does not use operator sessions.

This keeps the auth boundary explicit without committing the repo to Clerk or WorkOS internals. Replacing it later means swapping the session resolution path, not rewriting tenant authorization rules.

## Core commands

- `make test` runs the API test suite.
- `make test-integration` runs the Postgres-backed migration/auth/trace query integration path.
- `make lint` runs Ruff and Next.js linting.
- `make format` formats Python and web files.
- `make dev` runs the FastAPI service only.
- `make worker` runs the RQ worker for evaluation jobs.
- `curl http://localhost:8000/health` verifies the API is up.
- `curl http://localhost:3000` verifies the web shell is up.

## Trace payload policy

- `input_text` is rejected above `TRACE_INPUT_TEXT_MAX_CHARS` and previewed to 240 compacted characters.
- `output_text` is rejected above `TRACE_OUTPUT_TEXT_MAX_CHARS` and previewed to 240 compacted characters.
- `metadata_json` is rejected above 50 top-level keys or `TRACE_METADATA_MAX_BYTES` serialized bytes.
- retrieval metadata is optional and `retrieved_chunks_json` is capped at 100 entries.

These rules keep ingestion inspectable, bounded, and safe for local Postgres storage.

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

## Auth endpoints

- `POST /api/v1/auth/sign-in`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/sign-out`
