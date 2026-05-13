# Pulse M6 — On-Call Response Team Implementation Plan

Date: 2026-05-13
Status: Planned (not started)
Classification: Migration-safe platform feature (no autonomous execution)

## Objective
Replace static `Response Team` UI text with a real project/org-scoped on-call service in Pulse.

## Existing Repo Baseline (Must Reuse)
- Team membership already exists in Pulse settings:
  - UI: `apps/pulse/components/dashboard/content/settings-content.tsx` (`Team Members`)
  - Read/add/remove APIs:
    - `GET/POST /api/settings/team`
    - `DELETE /api/settings/team/{userId}`
  - Incident-assignable member list API:
    - `GET /api/incidents/members`
- This means on-call should reference existing organization members (`user_id`) instead of creating a separate person directory.

## Implementation Solution

### 1. Data Model
- `oncall_rotations`
  - `id`, `project_id` (nullable if org-scoped), `organization_id`, `name`, `timezone`, `is_active`
- `oncall_assignments`
  - `id`, `rotation_id`, `role` (`primary`, `secondary`, `lead`, `sre`), `user_id`, `starts_at`, `ends_at`
- `oncall_escalation_policy`
  - `id`, `rotation_id`, `step_order`, `target_role`, `wait_minutes`, `channel` (`slack`, `phone`, `email`)

### 2. API Contracts
- `GET /api/v1/projects/{id}/oncall`
  - Returns current roster + escalation policy + active override.
- `PUT /api/v1/projects/{id}/oncall/assignments`
  - Bulk update assignments by role/time window.
- `PUT /api/v1/projects/{id}/oncall/escalation-policy`
  - Update ordered escalation steps.
- `POST /api/v1/projects/{id}/oncall/override`
  - Create temporary manual override with expiry + reason.

### 2.1 Membership Integration Rule
- Assignment writes must validate `user_id` against existing org members (same source used by Team Members and incident assignment).
- If a roster references a user no longer in org membership, surface explicit invalid-assignment state and block activation until fixed.

### 3. UI Behavior
- Preferred route: `/projects/[projectId]/on-call`.
- Display current roster and escalation ladder.
- Initial seeded roster:
  - Primary: Sarah Miller
  - Secondary: Mike Chen
  - Platform Lead: Lisa Park
  - SRE: Tom Wilson
- Show "next escalation in X min" from policy timings.
- Rollout mode:
  - Read-only first.
  - Guarded write actions after auth/role checks are in place.

### 4. Auth and Permissions
- Viewer: read roster and policy.
- Operator/Admin: update assignments/policy + create overrides.
- Every write emits audit event (`actor`, `project`, `before`, `after`, `reason`, `timestamp`).

### 5. Reliability Requirements
- Missing roster is valid state; never surface as source-failure banner by default.
- Use short cache TTL for read endpoints + manual refresh control.
- Full audit trail for every assignment, policy, and override change.

## Delivery Plan

### M6.1 — Contract + Schema
- Define tables/types/migrations.
- Add backend handlers for all four endpoints.
- Seed current team roster for initial project/org.
- Wire assignment validation to existing org member source.

### M6.2 — Pulse Read Path
- Implement `/projects/[projectId]/on-call` read surface.
- Replace static roster cards with live data states (loaded/empty/error).

### M6.3 — Guarded Write Path
- Add assignment/policy edit forms.
- Enforce role checks and audit emission.
- Member-picker options must come from existing Team Members source (no free-form identity input).

### M6.4 — Override Workflow
- Add temporary override creation and expiry handling.
- Surface override events in timeline/audit views.

### M6.5 — Notification Integrations
- Trigger Slack escalation steps from policy.
- Add phone/email only if existing infra already supports it.

### M6.6 — Validation Gate
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- API tests: read/write/permission/audit
- Manual probes:
  - normal load
  - empty config state
  - unauthorized write attempt
  - escalation policy edit + audit verification

## Acceptance Criteria
- `/projects/[projectId]/on-call` renders real roster/policy data.
- Static hardcoded team list is fully removed from operational path.
- Write actions are role-guarded and audited.
- Empty config behaves as valid setup state, not hard failure.
- On-call assignees are selected from existing Team Members identities only.
