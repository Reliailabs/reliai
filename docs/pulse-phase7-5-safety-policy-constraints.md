# Pulse Phase 7.5 — Safety / Policy Constraints (Planning-Only)

## Status
Planning only. No execution/runtime policy engine changes.

## Objective
Define hard safety preconditions and blocklists for any future controlled actions.

## Hard Boundary
No action may execute in Phase 7.5. This slice defines constraints only.

## Constraint Model
```ts
type ActionPrecondition = {
  id: string;
  action_type: "ack" | "assign" | "open_remediation_task" | "propose_guardrail" | "rollback";
  scope: "organization" | "project" | "environment";
  requirement: string;
  severity: "block" | "warn";
  rationale: string;
};
```

## Baseline Safety Rules
1. **Evidence minimum**: no action proposal may be approved with `insufficient` confidence unless manually overridden with rationale.
2. **Rollback safety gate**: no rollback proposal may pass future execution gate without deployment evidence threshold and linked incident context.
3. **Cross-tenant block**: any target outside active org scope is blocked.
4. **Stale evidence block**: proposals using stale or unresolved evidence references are blocked.
5. **Policy override logging**: all manual overrides require explicit reason and audit record.

## Suggested Blocklists
- block any action targeting deleted/archived resources
- block proposals lacking evidence references
- block duplicate terminal decisions on same proposal
- block approvals by users lacking required role/scope

## Future Execution Preconditions (Phase 8 input)
Before any supervised execution:
- evidence threshold met
- approval recorded
- RBAC check passed
- target resource exists and is mutable
- rollback/apply scope verified

## Output for Slice 7.6
Feeds dry-run simulation contract and failure-mode reporting.

## Explicit Non-Goals
- no policy-engine runtime implementation
- no execution gates in code
- no rollback mechanics implementation
