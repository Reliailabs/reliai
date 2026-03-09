## current implemented milestones
- Milestone 1 foundation is implemented: organizations, organization members, projects, API keys, onboarding checklist, trace ingestion.
- Milestone 2 trace explorer is implemented: trace list API, trace detail API, filters, cursor pagination, frontend traces page, frontend trace detail page.
- Retrieval metadata persistence is implemented via `retrieval_spans`.
- Initial evaluation scaffold is implemented via RQ enqueueing and persisted `structured_validity` evaluations.

## verified commands
- `make test`
- `make lint`
- `pnpm --filter web build`
- `make db-migrate`
- `make seed`
- `docker compose up -d postgres redis`

## schema state
- Base tenant and project tables exist: `organizations`, `organization_members`, `projects`, `api_keys`, `onboarding_checklists`.
- Trace explorer schema is live: `traces` includes `organization_id`, `environment`, `input_preview`, `output_preview`.
- Retrieval schema is live: `retrieval_spans`.
- Evaluation schema is live: `evaluations`.
- Alembic revisions:
  - `20260309_0001` milestone one foundation
  - `20260309_0002` trace explorer and evaluation scaffold

## open risks
- Product endpoints still do not enforce real operator auth or tenant authorization.
- Backend tests run on SQLite; production runs on PostgreSQL.
- Ingest payload size controls are still shallow for large text fields and metadata.
- Evaluation coverage is intentionally narrow; only structured validity is scaffolded.

## next milestone plan
- Add additional v1 evaluations: relevance, groundedness, retrieval quality.
- Expose evaluation status more clearly in the traces list.
- Add organization/project authorization to product APIs.
- Start regression rollup groundwork needed for incidents.
- Prepare incident persistence and threshold definitions for the next vertical slice.
