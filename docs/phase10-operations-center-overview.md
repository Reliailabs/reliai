# Phase 10 — Operations Center Overview

## Purpose

The Operations Center is the first unified operational surface in Pulse. It surfaces the full lifecycle of automation proposals — from initial incident detection through policy gating, operator approval, controlled execution boundary, and verified outcomes — as a single chronological audit trail.

It is **not** an activity feed or a generic event log. Every entry in the Operations Center is either:
- A Phase 10 proposal lifecycle state transition
- A Phase 9 policy gate evaluation (passed or denied)
- An evidence receipt emission
- A kill-switch or governance event

---

## Core Invariant

The Operations Center never implies execution authority. The governance boundary statement is displayed prominently on the surface:

> **Assisted automation only.** All proposals require operator confirmation. `execution_granted: false` — no autonomous production mutations. Phase 9 policy gates enforced on every proposal.

This invariant is upheld at three levels:
- **Type level**: `execution_granted: false` is a TypeScript literal on `ProposalLifecycle` (Phase 10.1)
- **Display level**: `execution_boundary_entered` entries show an `execution_granted: false` badge in the UI
- **Data level**: all `OperationsTimelineEntry` objects have `requires_operator_review: true` as a literal type

---

## Route

`/operations` — renders inside `DashboardShell` as `initialSection="operations"`.

Accessible via the sidebar under "Core Reliability → Operations Center".

---

## Event Kinds

The timeline tracks 10 event kinds, each with a distinct visual identity:

| Kind | Label | Trigger |
|---|---|---|
| `incident_detected` | Incident Detected | Phase 10.1 lifecycle created (detected state) |
| `proposal_generated` | Proposal Generated | Lifecycle transitions `detected → analyzed` |
| `policy_gate_evaluated` | Policy Gate | Lifecycle transitions `analyzed → proposed`; also standalone denied events |
| `remediation_staged` | Staged | Lifecycle transitions `proposed → staged` |
| `approval_recorded` | Approved | Lifecycle transitions `staged → approved` |
| `receipt_emitted` | Receipt | Emitted immediately after `approved` transition |
| `execution_boundary_entered` | Execution Boundary | Lifecycle transitions `approved → executing` |
| `verification_result` | Verification | Lifecycle transitions `executing → verified` or `executing → failed` |
| `rollback_event` | Rollback | Lifecycle transitions `executing → rolled_back` |
| `kill_switch_event` | Kill Switch | Static fixture; will be operator-triggered in Phase 11 |

---

## Data Architecture

```
/operations (server page)
  └── getOperationsSurfaceData()          [lib/operations-timeline.ts, server-only]
        └── InMemoryOperationsTimelineRepository
              ├── buildEntriesFromLifecycle()  ← derives entries from Phase 10.1 lifecycle
              │     └── listLifecycles()        ← reads InMemoryProposalLifecycleRepository
              └── STATIC_FIXTURE_EVENTS         ← kill-switch, denied gate
                                                       ↓
  → OperationsSurfaceData (serialized at Server→Client boundary)
                                                       ↓
DashboardShell (initialSection="operations")
  └── MainContent (case "operations")
        └── OperationsTimelineView [client component]
              ├── StatsBar          ← aggregate counts by event kind
              ├── FilterBar         ← URL search param filters
              └── TimelineEntryCard ← per-entry display
```

### Persistence boundary

`OperationsTimelineRepository` interface defines the persistence contract:
```typescript
interface OperationsTimelineRepository {
  findAll(filter?: OperationsTimelineFilter): OperationsTimelineEntry[];
}
```
Phase 10 ships `InMemoryOperationsTimelineRepository` (fixture-backed). Phase 11 substitutes a DB-backed implementation at the `defaultRepository` assignment in `lib/operations-timeline.ts`.

---

## Filters

All filtering is **client-side** over the pre-fetched `OperationsSurfaceData`. Filter state is kept in URL query params for linkability:

| URL param | Values |
|---|---|
| `?kind=` | Any `OperationsTimelineEventKind` value |
| `?severity=` | `critical \| high \| medium \| low` |
| `?actor=` | `human \| system` |
| `?state=` | Any `ProposalLifecycleState` value |
| `?incident=` | Incident ID string |
| `?proposal=` | Phase 9 proposal_id string |

Multiple filters compose as AND. A "Clear" button removes all active filters.

---

## Entry Anatomy

Each timeline entry carries:

- **Kind badge** — color-coded, icon-annotated
- **Title** — human-readable description of the event
- **Summary** — phase transition reason, policy gate outcome, or actor action
- **Timestamp** — relative ("23m ago") with absolute tooltip
- **Actor** — operator email (human) or "Reliai System" (system)
- **Lifecycle state badge** — the proposal state at time of event
- **Policy gate badge** — "Gate passed" (green) or "Gate denied" (red) when applicable
- **Severity** — if the associated incident carried a severity signal
- **Evidence refs** — internal links to related records
- **execution_granted: false badge** — displayed on `execution_boundary_entered` entries

---

## Relationship to Phase 9

The Operations Center is a **projection** of Phase 9 data, not a replacement:

| Phase 9 artifact | Phase 10 representation |
|---|---|
| `validateAutomationEligibility()` result | `policy_gate_evaluated` entry |
| `validateOperatorConfirmation()` result | `approval_recorded` entry |
| `emitEvidenceReceipt()` result | `receipt_emitted` entry |
| `validateKillSwitchPolicy()` block | `kill_switch_event` entry |
| `proposal_id` (phase9-* format) | Carried on every `OperationsTimelineEntry.proposal_id` |

Phase 9 functions are not called by the Operations Center directly — the timeline entries are built from Phase 10.1 lifecycle state history, which itself was created after Phase 9 validations passed.

---

## Implementation Files

| File | Role |
|---|---|
| `apps/pulse/lib/operations-timeline.ts` | Repository interface, fixture implementation, `getOperationsSurfaceData()` |
| `apps/pulse/app/(app)/operations/page.tsx` | Server page |
| `apps/pulse/components/operations/operations-timeline-view.tsx` | Client component: stats, filters, timeline |
| `apps/pulse/components/dashboard/pulse-types.ts` | `OperationsTimelineEntry`, `OperationsSurfaceData`, `OperationsTimelineFilter` types |
| `apps/pulse/components/dashboard/sections.ts` | `"operations"` added to `Section` union |
| `apps/pulse/components/dashboard/dashboard-shell.tsx` | `operationsData?: OperationsSurfaceData` prop added |
| `apps/pulse/components/dashboard/main-content.tsx` | `case "operations"` wired; sectionConfig entry added |
| `apps/pulse/components/dashboard/app-sidebar.tsx` | "Operations Center" added to `mainMenu` |

---

## Phase 11 Extension Points

1. **Real persistence**: replace `InMemoryOperationsTimelineRepository` with a DB-backed implementation that queries `operations_timeline_events` table.
2. **Server-side filtering**: move filter evaluation to the repository query when working against large datasets.
3. **Kill switch management**: add operator UI to activate/clear kill switches from the Operations Center.
4. **Proposal deep-link**: `/operations/[proposalId]` — full proposal detail view with lifecycle stepper, verification results, and rollback history.
5. **Live updates**: SSE or polling for new events without full page reload.
