# Pulse Phase 9.1 — Automation Eligibility and Policy Gate

## Status
Implemented as a validation-only runtime guard.

## Objective
Define strict criteria for when assisted automation can be proposed or staged.

## Eligibility Rules
An automation candidate is eligible only when all are true:
1. Evidence density is `medium` or `high`.
2. Confidence is not `insufficient`.
3. Target surface has a defined rollback path or safe no-op fallback.
4. RBAC allows operator to approve staged automation.
5. Safety policy checks pass for target environment.

## Policy Gates
- Deny by default if any gate fails.
- High-risk environments may require dual approval.
- Production actions require explicit confirmation even in assisted mode.

## Output Contract
```ts
type AutomationEligibility = {
  eligible: boolean;
  reason_codes: string[];
  required_approvals: number;
  requires_operator_review: true;
};
```

## Non-Goals
- No execution implementation.
- No policy engine redesign.

## Runtime Guard Mapping
- Endpoint: `/api/actions/assisted-automation/eligibility/validate`
- Validator: `/apps/pulse/lib/assisted-automation.ts`
- Envelope contract:
  - `contract_version: "phase9-v1"`
  - `mode: "validation_only"`
  - `execution_granted: false`
