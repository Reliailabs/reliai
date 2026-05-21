# Pulse Functional Parity Audit Report

Date: 2026-05-21
Status: Active
Scope: apps/web -> apps/pulse functional behavior parity (post scope/ownership closure)

## 1) Summary

Scope and ownership migration is materially stabilized and test-gated.

High-impact functional parity gaps are closed. Remaining work is limited to explicitly deferred behavior, not route/ownership parity.

## 2) What Is Already Closed

- `project_id` continuity across core non-project routes
- deterministic project resolution (no implicit first-project behavior)
- ownership-shift route shims with canonical query output
- shared-shell alignment on recently migrated non-project surfaces (`/playground`, `/regressions`, `/regressions/[id]`)

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

## 4) Remaining Deferred Item

### External invite lifecycle ownership

Classification: `deferred behavior delta`  
Impact: `medium`

Current state:
- pending invitation persistence is now implemented in Pulse and exposed in Team settings
- admins can queue and revoke pending invites from the Settings surface
- ownership is documented in the Response Team continuity contract and settings UI copy
- `/signup` remains the explicit continuation path for users who do not yet have a Reliai account
- the no-account error state now queues a pending invitation and offers a contextual "Send invitation instead" handoff into `/signup`
- pending invitations now expose a tokenized `/join?token=...` redemption path and a local accept flow that creates the membership/session in the current auth stack
- the `/signup` surface still renders team-invite context when the handoff includes `entry=team-invite`
- email delivery remains deferred

## 5) Completion Criteria for Functional Parity
Functional parity can be called complete only when:
- all high-impact functional gaps are closed,
- remaining deferred items are explicitly documented with their implemented subset,
- migration tracker and gap report are in sync.
