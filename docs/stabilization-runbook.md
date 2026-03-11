# Reliai Stabilization Runbook

Last updated: March 11, 2026

Purpose:
- refresh the local stack to the current repo state
- run the product manually in a repeatable way
- verify the core operator workflow end to end
- keep marketing, docs, and product behavior aligned

Working rule:
- freeze feature expansion during this phase
- tighten only what already exists
- if a claim is true in the backend but unclear in the UI, fix wording or presentation instead of adding capability

## 1. Refresh The Local Stack

Run these from the repo root before each validation pass:

```bash
cp .env.example .env
make install
make db-up
make db-migrate
make seed
```

Expected local credentials after seed:
- `owner@acme.test`
- `reliai-dev-password`

## 2. Run The App Manually

Terminal 1:

```bash
make dev
```

Terminal 2:

```bash
pnpm --filter web dev --port 3000
```

Terminal 3:

```bash
make worker
```

Health checks:

```bash
curl -s http://127.0.0.1:8000/api/v1/health
curl -I http://127.0.0.1:3000
```

Optional automated gate before manual validation:

```bash
make qa
```

## 3. Auth Validation Baselines

### Local Dev Auth

Use this as the primary validation baseline because it is deterministic.

Required env:

```env
RELIAI_DEV_AUTH_ENABLED=true
```

Validation path:
- sign in at `http://127.0.0.1:3000/sign-in`
- use the seeded credentials
- confirm access to product and internal system surfaces

### WorkOS

Use this as the secondary validation path.

Required env values live in `.env.example`:
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI`
- `WORKOS_LOGOUT_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`
- `WORKOS_SCIM_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`

Keep these aligned to `http://127.0.0.1:3000` for local testing.

WorkOS validation path:
- confirm the sign-in page switches out of dev-only messaging
- confirm callback and logout redirect correctly
- confirm the post-login destination matches the product shell

## 4. Core Workflow To Prove

This is the loop that must work before new feature work resumes:

`trace ingest -> regression detection -> incident -> trace investigation -> guardrail recommendation -> deployment safety gate`

Primary operator proof path:
1. ingest or simulate a failing trace pattern
2. confirm a regression or incident opens
3. open incident detail and the command center
4. pivot into the trace graph
5. confirm a mitigation recommendation is visible
6. confirm the related deployment surface shows a safety state

## 5. Validation Tracks

### Marketing Claim Verification

Homepage claims to prove:
- detects regressions
- explains root causes
- applies guardrails
- protects production systems

Acceptance criteria:
- incident opens from a failure condition
- root-cause signals are visible in incident surfaces
- guardrail recommendation or policy signal is visible
- deployment gate or deployment safety state reacts

### Demo Path Verification

Use these docs as the source of truth:
- `docs/demo_checklist.md`
- `docs/demo_script.md`

Validate this sequence in one uninterrupted session:
- control panel
- incident
- trace graph
- replay
- deployment safety gate

### SDK Verification

Python:
- install SDK
- initialize client
- send a trace and span
- verify both land in the product

Node:
- install SDK
- initialize client
- send a trace and span
- verify ingest works
- verify guardrail hook path works
- verify policy sync path works

### Guardrail Policy Verification

Test policy enforcement modes:
- observe
- warn
- enforce
- block

Test failure types:
- structured output violation
- latency violation
- cost violation

Verify:
- `policy_violation` event exists
- guardrail intervention is recorded
- control-panel or compliance surfaces reflect the change

### Event-First Verification

Event types to explicitly check:
- `trace_ingested`
- `trace_evaluated`
- `policy_violation`
- `deployment_created`
- `incident_opened`

For each:
- event exists in `event_log`
- downstream processor ran
- derived state updated

Replay verification:
- run `reprocess_events_worker`
- confirm replay does not corrupt derived state
- confirm operator surfaces remain coherent after replay

### Marketing Surface Verification

Routes to check:
- `/`
- `/demo`
- `/playground`
- `/marketing/screenshot/control-panel`
- `/marketing/screenshot/trace-graph`
- `/marketing/screenshot/incident`
- `/marketing/screenshot/deployment`
- `/marketing/screenshot/playground`

Generate screenshots:

```bash
pnpm screenshots:marketing:core
pnpm screenshots:marketing
pnpm screenshots:playground
```

Acceptance criteria:
- routes load without auth where expected
- screenshot routes hide navigation chrome
- no drifting timestamps
- layouts are stable
- screenshots reflect real implemented UI

## 6. Documentation Tightening Rule

If validation reveals mismatch between product and docs, update only these:
- `docs/sales-product-update.md`
- `docs/product-capabilities.md`
- `docs/demo_script.md`
- `docs/demo_checklist.md`

Do not widen product claims to match ambition. Narrow claims until they match the current system.

## 7. Signoff Standard

This phase is complete only when:
- the demo works cleanly end to end
- homepage claims are true in the product
- SDK install claims are validated
- screenshots reflect actual UI behavior
- docs match reality
- local dev auth and WorkOS paths are both documented and testable
