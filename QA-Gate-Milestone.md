Good call. At this stage of the project, periodic QA is just as important as building features. Otherwise regressions will creep in quickly as the system gets more complex.

For a project like Reliai, QA should happen at three levels: automated, milestone-level, and exploratory/operator QA.

⸻

1. Add a QA Gate for Every Milestone

Before starting the next milestone, run a QA sweep of the current system.

Your QA checklist should include:

Backend

Run:

pytest apps/api/tests
ruff check apps/api
alembic upgrade head

Verify:
• migrations run clean on a fresh DB
• no schema drift
• tenant isolation still works
• compare endpoints return valid payloads
• incident lifecycle still works

Frontend

Run:

pnpm --filter web build
pnpm --filter web lint

Verify:
• incidents list loads
• compare pages load
• regression pages load
• settings page works
• filters still work

Worker Jobs

Manually test:
• incident open
• alert delivery
• retry logic
• regression recompute

⸻

2. Add a Dedicated QA Prompt for Codex

Use this periodically so the AI audits the repo.

Example prompt:

Read AGENTS.md and docs/02-full-technical-build-spec.md.

Run a full QA pass on the Reliai codebase.

Tasks:

1. Identify broken or risky code paths
2. Check schema vs model mismatches
3. Detect dead code
4. Detect missing tests
5. Identify API inconsistencies
6. Validate tenant isolation
7. Validate compare endpoints
8. Validate incident lifecycle

Also review:

- migrations
- service layer logic
- API contracts
- frontend API client usage

Constraints:

- avoid AI slop
- prefer explicit issues with file paths
- do not refactor large areas unless necessary

Return:

1. QA findings
2. risky areas
3. missing tests
4. recommended fixes
5. prioritized bug list

Running this every 2–3 milestones will catch a lot.

⸻

3. Add an Operator QA Script

This is manual but important.

Every couple milestones simulate real usage:

Incident workflow 1. Send traces 2. Trigger regression 3. Verify incident opens 4. Verify Slack alert 5. Ack incident 6. Assign owner 7. Resolve incident

Investigation workflow

Test:
• incident compare
• regression compare
• trace detail
• cohort pivots
• representative traces

⸻

4. Add Synthetic Data Tests

You want deterministic test data for:
• latency spike
• cost spike
• failure spike
• structured output regression

Create fixtures that simulate these patterns so compare logic stays correct.

⸻

5. Add a CI QA Pipeline (Soon)

Once the repo stabilizes, add CI:

Pipeline should run:

pytest
ruff
migrations check
pnpm build

Later add:
• Playwright UI tests
• API contract tests

⸻

6. One More Important QA Habit

Before adding a feature, run:

"Does this break investigation?"

Specifically test:
• incident page
• regression page
• compare page
• trace pivots

Those are the core product loops now.

⸻

My recommendation

Add a file in the repo:

docs/QA-CHECKLIST.md

Include:
• milestone QA steps
• manual investigation workflow tests
• CI commands
• synthetic data scenarios

Then instruct Codex:

Before starting each milestone, run QA-CHECKLIST.md.

⸻
