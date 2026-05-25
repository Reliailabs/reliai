# Pulse Core Loop Preflight Validation Report

Status: Pending Execution
Date: 2026-05-25
Scope: Pre-user simulation proof for Pulse core loop

## Purpose

This report is a pre-user gate. It is not production-readiness proof.

Goal:
- prove core loop behavior under deterministic simulation before inviting external testers

## Validation Source Model

- Primary source for this report: simulation/demo telemetry + app/API/runtime evidence
- This report does not replace production canary evidence

## Test Window

- Start (UTC):
- End (UTC):
- Duration:
- Environment:
- Release SHA:
- Branch/PR (if applicable):

## Core Loop Pass/Fail Matrix

1. OTel/demo ingest reaches Pulse
- Evidence:
- Result: `pass | fail`

2. First trace visible in UI and API
- Evidence:
- Result: `pass | fail`

3. Regression/incident path triggered or deterministically simulated
- Evidence:
- Result: `pass | fail`

4. Incident detail loads with correct project scope
- Evidence:
- Result: `pass | fail`

5. Operations/proposal/verification surfaces load from that incident
- Evidence:
- Result: `pass | fail`

6. Operator action path returns explicit success/failure (no fake success)
- Evidence:
- Result: `pass | fail`

7. Degraded dependency paths fail closed
- Evidence:
- Result: `pass | fail`

8. Evidence package completeness
- Required fields:
  - timestamps
  - release SHA
  - logs/queries
  - screenshots (if useful)
- Result: `pass | fail`

## Soak Summary

- Soak mode: `demo/simulation`
- Soak duration target: `4h` minimum (`24h` preferred)
- Notable anomalies:
- Incident count/severity observed:

## Failure Conditions

Any single failed item in the pass/fail matrix blocks external tester invitation.

If blocked:
- open remediation issue(s)
- assign owner
- capture fix ETA

## Final Decision (Required)

- `GO_FOR_TESTERS`
- `HOLD_FIX_CORE_LOOP`
- `ROLLBACK`

Decision:
- Selected:
- Decision owner:
- Reviewer:
- Timestamp (UTC):
- Rationale:

## Next Step Rule

- If `GO_FOR_TESTERS`:
  - proceed to 5% production canary and only then invite external testers
- If `HOLD_FIX_CORE_LOOP`:
  - no external testers until failed items are fixed and revalidated
- If `ROLLBACK`:
  - rollback first, analyze second, then rerun preflight
