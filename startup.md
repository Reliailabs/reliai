The app is running locally and reachable.

Use:

Web: http://localhost:3000
API docs: http://localhost:8000/docs
Seeded operator login:

Email: owner@acme.test
Password: reliai-dev-password
Seeded test data:

Project ID: cb2dfd2d-69af-4545-a2e8-131bf6e491b8
API key: reliai_j9SI5ULq9U2MgFCT24fSlCVxx5LlkjYn
What I did:

created repo .env
migrated Postgres through 20260309_0005
seeded local data
started API, web, and RQ worker
verified http://localhost:3000 and http://localhost:8000/docs both return 200
One issue surfaced while getting it up:

the root .venv was broken and pointed to another workspace, so I replaced it with a fresh Python 3.12 venv and installed apps/api/requirements.txt
If you want, I can next walk through a concrete end-to-end test: sign in, ingest a trace, and verify incident/alert behavior.

There are two ways to access the seeded test data.

In the UI:

- Open [http://localhost:3000](http://localhost:3000)
- Sign in with `owner@acme.test`
- Use password `reliai-dev-password`

That seeded operator is attached to the seeded org/project, so you should see the dashboard, incidents, and project-linked data for the local workspace.

For API-level testing:

- Open [http://localhost:8000/docs](http://localhost:8000/docs)
- Use the seeded API key `reliai_j9SI5ULq9U2MgFCT24fSlCVxx5LlkjYn` on ingest endpoints that require project auth
- The seeded project id is `cb2dfd2d-69af-4545-a2e8-131bf6e491b8`

If you want actual traces/regressions/incidents to appear, the seed only gives you the operator, org, project, and API key. You still need to ingest traces. I can give you a ready-to-run `curl` that creates a trace and lets you watch it flow into evaluations and incidents.
