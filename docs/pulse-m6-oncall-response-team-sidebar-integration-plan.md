# Pulse M6 — Response Team Sidebar Integration Plan

Date: 2026-05-13
Status: Planned (not started)
Classification: Migration-safe UX wiring

## Problem
The current bottom-right `Response Team` card is decorative static text. It provides no operational value and can mislead operators.

## Objective
Turn the sidebar card into a project-aware, stateful, and traceable incident control surface.

## Existing Repo Baseline (Must Reuse)
- Current static card is in `apps/pulse/components/dashboard/right-panel.tsx` (`oncallTeam` hardcoded array).
- Team management already exists in settings:
  - `apps/pulse/components/dashboard/content/settings-content.tsx`
  - `/api/settings/team` and `/api/settings/team/{userId}`
- Incident-member identity source already exists:
  - `/api/incidents/members`

## Utilization Design

### 1. Context-Aware
- Bind sidebar `Response Team` to currently selected `projectId`.
- Load current assignees from on-call API, not hardcoded names.
- Roles shown: Primary, Secondary, Platform Lead, SRE.
- Assignee identities must map to existing Team Members user records.

### 2. Operational Actions
- Add guarded quick actions:
  - `Page Primary`
  - `Escalate to Secondary`
  - `Open Incident War Room`
- Show current escalation step and availability state.

### 3. Stateful Behavior
- Source from `GET /api/v1/projects/{id}/oncall`.
- If no roster configured:
  - show explicit empty-state CTA (`Configure On-Call`) instead of fake roster.
- Keep status badges live (`on-call`, `override active`, `off-shift`).

### 4. Traceability
- Every action from sidebar writes audit events.
- Link audit/timeline entries back to incident and project context.

### 5. Migration-Safe Rollout
- Phase A: replace static roster with live read-only data.
- Phase B: enable guarded actions (`page`, `escalate`, `override`).
- Phase C: connect actions to incident/timeline/notification flows.

## Implementation Slices

### M6.S1 — Sidebar Read Wiring
- Replace hardcoded card data with API-backed model.
- Add loading/empty/error states.
- If no on-call roster exists but Team Members exist, show `Configure On-Call` CTA with member count.

### M6.S2 — Action Surface Wiring
- Add action buttons and server actions with role guards.
- Add optimistic UI + rollback behavior on failures.

### M6.S3 — Incident and Timeline Linkage
- Add deep-links to current incident context and war room.
- Add timeline/audit references for each action.

### M6.S4 — Observability and Hardening
- Add metrics/logging for action latency/failures.
- Validate fallback behavior when escalation integrations are unavailable.

## Validation Gate
- `pnpm --filter pulse lint`
- `pnpm --filter pulse build`
- Sidebar functional probes:
  - configured roster visible
  - empty-state CTA visible when unconfigured
  - unauthorized action blocked
  - authorized action writes audit event

## Acceptance Criteria
- Sidebar shows real project-scoped response team state.
- At least `Page Primary` and `Escalate to Secondary` are live, guarded, and audited.
- No static hardcoded response-team text remains on operational surfaces.
