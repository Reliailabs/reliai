# Pulse Production Validation Stack

Status: Active  
Date: 2026-05-25  
Scope: Operational validation model for `apps/pulse`

## Boundary

OpenTelemetry demo instrumentation is valid for local pipeline checks, but it is not production-readiness evidence.

Production validation question:

`Can Pulse safely operate under real production traffic with trustworthy operational signals?`

## Layered Validation Model

## Layer 1 — Real Production Telemetry (Primary Source of Truth)

This is the only acceptable source for rollout evidence decisions.

Required sources:
- request metrics
- traces
- structured logs
- deployment metadata
- incident events
- auth/session events

Evidence records for canary decisions must come from these sources, not synthetic demo traffic.

## Layer 2 — Synthetic Canary Probes (Required)

Production users at 5% rollout are sparse and uneven. Synthetic probes are required to prevent false confidence from low traffic.

Required probe coverage:
- login flow
- onboarding
- operations page
- settings/billing
- incident surfaces
- route-shell rendering

Operational requirement:
- Run authenticated Playwright probes every 5–15 minutes during canary.
- Export probe outcomes into telemetry with:
  - environment
  - release SHA
  - rollout phase
  - probe type

Probe outcomes are part of the evidence package.

## Layer 3 — OpenTelemetry Demo (Support Layer)

Use OTel demo stack for:
- local instrumentation checks
- collector pipeline validation
- schema evolution tests
- trace enrichment validation
- dashboard development

Do not use OTel demo as operational-readiness proof.

## Required Operational Capabilities

## A) Release Correlation

Metrics/logs/traces used for rollout decisions must include:
- release SHA
- deployment timestamp
- rollout phase
- environment
- project/org scope (when applicable)

Without release correlation, deployment impact cannot be attributed reliably.

## B) Golden Signal Rollout Dashboard

One rollout view must exist with at least:

Reliability:
- request rate
- error rate
- latency p50/p95/p99
- availability

Auth:
- login failures
- callback failures
- session invalidation spikes
- unexpected `401/403`

Scope integrity:
- project scope mismatch events
- forbidden cross-project attempts
- malformed scope requests

Operations integrity:
- incident creation failures
- proposal execution failures
- receipt append failures

Billing/settings:
- checkout failures
- settings load failures
- degraded dependency fallbacks

Synthetic probe health:
- pass rate
- median duration
- route failures by type

## Practical Setup (Current Phase)

Keep:
- OpenTelemetry Collector
- Tempo/Jaeger
- Prometheus
- Grafana

Add:
- synthetic Playwright probes
- release metadata tagging
- structured app-level event logging
- deployment markers in Grafana

Avoid in this phase:
- custom observability platform expansion
- complex sampling experiments
- anomaly-detection rollout automation
- auto-remediation

Current phase objective is operational trust establishment.

## Evidence Artifact Policy

Short term:
- manual evidence records are acceptable

Target state:
- evidence records generated from dashboard/query snapshots
- attached automatically to rollout reviews
- stored as immutable operational artifacts

## Related Docs

- `docs/pulse-production-validation-checklist.md`
- `docs/pulse-slo-error-review-runbook.md`
- `docs/pulse-production-validation-cycle1-evidence-record.md`
