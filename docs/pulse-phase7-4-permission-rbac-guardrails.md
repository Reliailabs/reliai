# Pulse Phase 7.4 — Permission / RBAC Guardrails (Planning-Only)

## Status
Planning only. No enforcement implementation in this slice.

## Objective
Define deny-by-default RBAC policy for controlled-action approvals.

## Hard Boundary
No mutation endpoints or runtime enforcement changes in Phase 7.4.

## Roles (Planning)
- `viewer`
- `operator`
- `owner`
- `system_admin`

## Policy Principle
Default deny for all controlled actions unless explicitly allowed by role and scope.

## Action Class Matrix (Planning)
| Action | viewer | operator | owner | system_admin |
|---|---:|---:|---:|---:|
| propose `ack` | ❌ | ✅ | ✅ | ✅ |
| approve `ack` | ❌ | ✅ | ✅ | ✅ |
| propose `assign` | ❌ | ✅ | ✅ | ✅ |
| approve `assign` | ❌ | ❌ | ✅ | ✅ |
| propose `open_remediation_task` | ❌ | ✅ | ✅ | ✅ |
| approve `open_remediation_task` | ❌ | ❌ | ✅ | ✅ |
| propose `propose_guardrail` | ❌ | ✅ | ✅ | ✅ |
| approve `propose_guardrail` | ❌ | ❌ | ✅ | ✅ |

## Scope Constraints
All allow rules are constrained by:
- organization membership
- project/environment scope
- target resource ownership/visibility

Cross-tenant and out-of-scope targets must be denied.

## Audit Requirements
Every denied or allowed decision must emit a permission-check audit event containing:
- actor id + role
- requested action
- target scope
- allow/deny outcome
- policy rule id matched
- timestamp

## Elevation Rules
- No implicit elevation.
- Temporary elevation (if supported later) must be explicit, time-bound, and audited.

## Output for Slice 7.5
Feeds safety/policy constraint contract and precondition checks.

## Explicit Non-Goals
- no role UI redesign
- no token/session model change
- no policy engine implementation
