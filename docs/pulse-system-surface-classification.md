# Pulse System Surface Classification

Date: 2026-05-21  
Status: Active classification baseline (F2)

## Scope

This document closes the F2 ambiguity by classifying each `/system` surface as one of:
- `implement` (owned functional surface in Pulse)
- `defer` (known parity gap with explicit owner + target phase)
- `intentional exception` (legacy alias/redirect kept for deep-link continuity)

## Classification Matrix

| Surface | Source (`apps/web`) | Pulse status | Class | Owner | Target phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/pulse/system` | `/system` | implemented | implement | Migration | current functional parity | Canonical Pulse system landing surface. |
| `/pulse/system/platform` | `/system/platform` | implemented | implement | Migration | current functional parity | Read-only telemetry parity surface. |
| `/pulse/system/pipeline` | `/system/pipeline` | implemented | implement | Migration | current functional parity | Read-only telemetry parity surface. |
| `/pulse/system/extensions` | `/system/extensions` | implemented | implement | Migration | current functional parity | Read-only telemetry parity surface. |
| `/pulse/system/customers` | `/system/customers` | implemented | implement | Migration | current functional parity | Cross-project customer board parity surface. |
| `/pulse/system/customers/[projectId]` | `/system/customers/[projectId]` | implemented | implement | Migration | current functional parity | Project-level customer detail parity surface. |
| `/pulse/system/reliability-patterns` | `/system/reliability-patterns` | implemented | implement | Migration | current functional parity | Pattern board parity surface. |
| `/pulse/system/growth` | `/system/growth` | implemented | implement | Migration | current functional parity | Growth telemetry parity surface. |
| `/pulse/system/expansion` | `/system/expansion` | implemented | implement | Migration | current functional parity | Expansion telemetry parity surface. |
| `/pulse/system/intelligence` | `/system/intelligence` | implemented | implement | Migration | current functional parity | Read-only intelligence telemetry surface. |
| `/system` | `/system` | redirects to `/pulse/system` | intentional exception | Migration | permanent alias policy | Legacy deep-link alias only. |
| `/system/*` (all listed subroutes) | `/system/*` | redirects to `/pulse/system/*` | intentional exception | Migration | permanent alias policy | Legacy subroute aliases preserved for inbound links. |
| `/pulse/systems` | n/a (legacy Pulse spelling) | redirects to `/pulse/system` | intentional exception | Migration | permanent alias policy | Backward compatibility alias for old Pulse links. |
| `/system/customers/[projectId]` | `/system/customers/[projectId]` | redirects to `/pulse/system/customers/[projectId]` | intentional exception | Migration | permanent alias policy | Legacy deep-link alias for project-level customer detail. |

## Decision Rules

1. `intentional exception` surfaces must be redirect-only, no duplicate owned UI.
2. `defer` rows require a target phase and cannot remain unowned.
3. Any new system surface must be added to this matrix in the same PR.
