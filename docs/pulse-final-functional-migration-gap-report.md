# Pulse Functional Parity Audit Report

Date: 2026-05-21
Status: Active
Scope: apps/web -> apps/pulse functional behavior parity (post scope/ownership closure)

## 1) Summary

Scope and ownership migration is materially stabilized and test-gated.

High-impact functional parity gaps are closed. Functional parity migration is complete for the tracked surfaces.

## 2) What Is Already Closed

- `project_id` continuity across core non-project routes
- deterministic project resolution (no implicit first-project behavior)
- ownership-shift route shims with canonical query output
- shared-shell alignment on recently migrated non-project surfaces (`/playground`, `/regressions`, `/regressions/[id]`)
- Response Team functional continuity across settings and on-call surfaces
- system-surface classification and read/write parity matrices

Validation backing:
- `pnpm --filter pulse test:migration-scope-parity-gate`
- `pnpm --filter pulse test:e2e:app-route-gate`

## 3) Closed Functional Gaps

### F1. Response Team end-to-end functional continuity

Classification: `functional continuity gap`
Impact: `high`
State: `closed`

Evidence:
- Team member add/invite from `/settings#team` is assignable in `/on-call`
- project scope switching in `/on-call` does not leak assignment context
- access role labels are not conflated with on-call duty roles

### F2. Deferred/legacy system surface classification

Classification: `deferred behavior delta`
Impact: `medium`
State: `closed`

Evidence:
- legacy system surfaces are classified as implement/defer/intentional exception
- deferred placeholder language was removed from canonical system landing surfaces
- legacy aliases remain redirect-only wrappers

### F3. Read/write parity matrix completion

Classification: `read/write delta`
Impact: `high`
State: `closed`

Evidence:
- route-level create/edit/approve/execute/rollback matrix exists and is owner-tagged
- unresolved write gaps have explicit defer/implement decisions with target phase

## 4) Invite Lifecycle Delivery Closure

Classification: `functional continuity gap`
Impact: `medium`
State: `closed`

Current state:
- pending invitation persistence is implemented and surfaced in Team settings
- admins can queue and revoke pending invitations from the Settings surface
- queued invites expose a tokenized `/join?token=...` redemption path
- invite redemption creates membership/session in the local auth stack
- delivery contract is explicit:
  - `email_webhook_dispatched` when delivery webhook is configured and succeeds
  - `manual_join_link` fallback when delivery is not configured or unavailable
- `/join` remains a documented public ownership shim for invite acceptance and is intentionally outside `(app)`
- `/signup` remains the continuation path for users starting account setup from invitation context

## 5) Completion Criteria for Functional Parity
Functional parity can be called complete only when:
- all high-impact functional gaps are closed,
- migration tracker and gap report are in sync.
