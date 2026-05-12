# Phase 12.1 — Incident Operations Surface

## Route Purpose
- Route: `/operations/incidents/[id]`
- Purpose: provide a single Pulse-native, read-only incident operations workspace that composes incident context, operations timeline evidence, and proposal lifecycle history into one operator flow.
- This is an IA proof for Phase 12 before any write-path/event-ingest implementation.

## Tab Model
- `Overview`: incident snapshot + reliability context summary.
- `Investigation`: observed contributing factors + evidence links.
- `Compare`: compare/deep-link references when available.
- `Timeline`: operations timeline entries scoped to incident.
- `Proposals`: proposal lifecycle records scoped to incident/proposal linkage.
- `Verification`: verified/failed lifecycle outcomes and verification IDs.
- `Rollback`: rollback-related lifecycle states (read-only record view).

## Read-Only Constraints
- No writes.
- No execution.
- No approvals.
- No rollback actions.
- No redirects replacing existing `/incidents/[id]` route.
- Surface is explicitly advisory and requires operator review.

## Data Sources
- Incident detail/read model: `/tmp/reliai-phase12/apps/pulse/lib/incidents-data.ts`
- Operations timeline entries: `/tmp/reliai-phase12/apps/pulse/lib/operations-timeline.ts`
- Proposal lifecycle records: `/tmp/reliai-phase12/apps/pulse/lib/proposal-lifecycle.ts`
- Adapter mode boundary (fixture/live): `/tmp/reliai-phase12/apps/pulse/lib/operations-adapter.ts`
- Composed read surface adapter: `/tmp/reliai-phase12/apps/pulse/lib/incident-operations-data.ts`

## Future Write-Path Exclusions (Phase 12.1)
- No event-ingest endpoint wiring.
- No lifecycle creation/state transition writes from UI.
- No command proposal/approval/execute handlers.
- No persistence-layer additions for this slice.
