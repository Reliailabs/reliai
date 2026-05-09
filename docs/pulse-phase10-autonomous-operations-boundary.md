# Pulse Phase 10+ — Autonomous Operations Boundary

## Status
Planning-only boundary definition. No implementation authorized.

## Objective
Define strict conditions under which any autonomous reliability operations could be considered.

## Position
Autonomous operations are optional and deferred. Reliai default remains supervised, human-in-the-loop control.

## Minimum Prerequisites
1. Multi-quarter evidence quality stability.
2. Assisted automation false-positive rates below approved threshold.
3. Reliable rollback and recovery success metrics.
4. Complete auditability coverage for all controlled actions.
5. Governance and security sign-off.

## Hard Safety Boundaries
Autonomous mode must never:
- mutate certification state silently
- bypass RBAC/policy checks
- execute cross-tenant actions
- suppress operator visibility of actions/outcomes

## Required Controls if ever enabled
- Opt-in per org and per environment.
- Time-boxed pilot mode only.
- Immediate kill-switch at org and global scope.
- Continuous audit review and incident postmortems.

## Non-Goals
- No autonomous execution rollout in this phase.
- No default-on automation behavior.
- No replacement of operator approval flows.
