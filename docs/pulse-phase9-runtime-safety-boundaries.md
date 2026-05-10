# Pulse Phase 9.1 — Runtime Safety Boundaries

## Hard Constraints
- No autonomous execution.
- No silent mutations.
- No cross-tenant fan-out.
- No severity/certification mutation by automation path.

## Allowed
- Generate proposal
- Stage non-mutating preview
- Emit evidence receipt
- Await explicit operator confirmation

## Disallowed
- Execute rollback directly from proposal generation
- Auto-apply remediation
- Auto-close incidents
