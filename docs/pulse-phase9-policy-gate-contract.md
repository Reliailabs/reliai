# Pulse Phase 9.1 — Policy Gate Contract

## Objective
Define enforcement criteria before any assisted proposal can be staged.

## Must-Pass Gates
1. Tenant scope verified (org/project/environment).
2. Policy eligibility = true for action class.
3. Evidence density meets threshold.
4. Operator confirmation required for all mutating outcomes.
5. Rollback path defined (or explicit non-reversible warning).
6. Blast radius within configured boundary.

## Rejection Rule
If any gate fails, runtime returns a policy-denied envelope and no staging artifact is created.
