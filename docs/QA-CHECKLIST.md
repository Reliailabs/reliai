# QA Checklist

Use this checklist before starting each milestone and after any substantial investigation or incident workflow changes.

This is the Reliai QA gate. It exists to keep the operator loop reliable as the product grows:

- trace ingestion
- evaluations
- regressions
- incidents
- alerts
- investigation compare flows

## Milestone QA Gate

Run these commands before the next milestone starts.

Preferred local entry point:

```bash
make qa
```

That target mirrors the backend and frontend automated checks below.

### Backend

```bash
pytest apps/api/tests
ruff check apps/api
cd apps/api && alembic upgrade head
```

Verify:

- migrations run clean on a fresh database
- no schema drift between migrations, models, and API contracts
- tenant isolation still holds across incident, regression, trace, and settings reads
- compare endpoints return valid payloads
- incident lifecycle still works end to end

Backend areas to explicitly spot-check:

- incident list and detail
- regression detail and compare
- incident compare
- trace compare
- org alert target settings

### Frontend

```bash
pnpm --filter web build
pnpm --filter web lint
```

Verify:

- incidents list loads
- incident detail loads
- incident compare page loads
- regression pages load
- regression compare page loads
- settings page works
- filters still work
- prompt/model pivots still work

### Worker Jobs

Manually test:

- incident open
- alert delivery
- retry logic
- regression recompute
- incident reopen path

## Operator QA Script

Run this every couple milestones or before shipping any investigation-heavy change.

### Incident Workflow

1. Send traces.
2. Trigger a regression.
3. Verify an incident opens.
4. Verify Slack alert delivery.
5. Acknowledge the incident.
6. Assign an owner.
7. Resolve the incident.
8. Re-trigger the same breach and verify deterministic reopen behavior.

### Investigation Workflow

Test:

- incident compare
- regression compare
- trace detail
- trace compare
- cohort pivots
- representative trace selection
- prompt/model version pivots

## Synthetic Data Scenarios

Keep deterministic fixtures or seed helpers for these patterns:

- latency spike
- cost spike
- failure spike
- structured output regression

Use these scenarios to verify:

- rollups
- regression snapshots
- incident opening
- compare payloads
- trace pairing
- root-cause hints

## Codex QA Audit Prompt

Use the dedicated QA audit prompt periodically, especially every 2 to 3 milestones.

Reference:

- `/Users/robert/Documents/Reliai/QA-Prompt-Codex.md`

Expected QA audit scope:

- broken or risky code paths
- schema vs model mismatches
- dead code
- missing tests
- API inconsistencies
- tenant isolation
- compare endpoints
- incident lifecycle

## CI QA Pipeline

Add or maintain a CI pipeline that runs:

```bash
pytest apps/api/tests
ruff check apps/api
cd apps/api && alembic upgrade head
pnpm --filter web build
pnpm --filter web lint
```

Add later when the repo is stable enough:

- Playwright UI tests
- API contract tests

## Pre-Feature Investigation Check

Before adding a new feature, ask:

`Does this break investigation?`

Always test:

- incident page
- regression page
- compare page
- trace pivots

These are core product loops and regressions here are high priority.

## Working Rule

Before starting each milestone, run this checklist.
