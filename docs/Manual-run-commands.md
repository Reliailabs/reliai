Manual run commands:

cp .env.example .env
make install
make db-up
make db-migrate
make seed

Then run:

make dev
pnpm --filter web dev --port 3000
make worker

Health checks:

curl -s http://127.0.0.1:8000/api/v1/health
curl -I http://127.0.0.1:3000

Current validation baseline:

alembic upgrade head now passes
reseed completed successfully
seeded operator:
owner@acme.test
reliai-dev-password
current seeded project:
cb2dfd2d-69af-4545-a2e8-131bf6e491b8
What I verified:

../../.venv/bin/python -m alembic upgrade head
reseed via app.scripts.seed
pnpm --filter web lint
pnpm --filter web build
What is still failing:

make qa does not pass yet. Backend suite currently has 27 failures.
The main failure clusters are:
fake warehouse test fixtures missing the new storage_trace_id
deployment simulation querying beyond the 24-hour raw trace window
archive worker tests creating Trace rows without required trace_id
clickhouse migration test expecting 003 while repo now applies 004
docker compose up -d postgres redis also hit a local container-name conflict on reliai-redis, so the local Docker state is not clean even though the database itself was reachable.
Tradeoff:

I fixed the migration path because it blocked the “refresh the full app” sequence directly. I did not start fixing the broader failing test clusters yet, since that is the next stabilization phase rather than documentation setup.
Next recommended step:

Triage and fix the 27 failing backend tests in cluster order: warehouse fixture drift first, then trace/deployment simulation assumptions, then clickhouse migration expectations.

Onboarding simulation smoke check:

python scripts/smoke_onboarding_simulation.py \
	--base-url http://127.0.0.1:8000 \
	--email owner@acme.test \
	--password reliai-dev-password
