# Pulse M5.4 — Project-Scoped Parity Closure Audit

Date: 2026-05-10

## Gate Classification
- Classification: `Migration`
- Net-new behavior: `No`
- Source-of-truth checked: `apps/web`
- Pulse parity status: `Partial` (route + scoped data parity)
- Phase 9 impact: `Blocked` until migration completion gate passes

## Routes Audited
- `/projects/[projectId]`
- `/projects/[projectId]/incidents`
- `/projects/[projectId]/audits`
- `/projects/[projectId]/traces`
- `/projects/[projectId]/deployments`
- `/projects/[projectId]/guardrails`
- `/projects/[projectId]/metrics`

## Audit Findings

| Route | Pulse status | Source parity level | Notes |
|---|---|---|---|
| `/projects/[projectId]` | Present | Partial | Project control snapshot wired; full control presenter parity pending. |
| `/projects/[projectId]/incidents` | Present | Partial | Route/context parity in place; strict project-level filtering remains best-effort. |
| `/projects/[projectId]/audits` | Present | Partial | Route/context parity in place; full stage/results/new project-aware parity pending. |
| `/projects/[projectId]/traces` | Present | Partial | Route/context parity in place; full trace detail presenter project-aware parity pending. |
| `/projects/[projectId]/deployments` | Present | Partial | Scoped deployments fetch wired by project; full deployment-detail presenter parity pending. |
| `/projects/[projectId]/guardrails` | Present | Partial | Route added; project-aware guardrail fetch wired; full guardrail presenter parity pending. |
| `/projects/[projectId]/metrics` | Present | Partial | Route added; project-aware metrics/errors fetch wired; full custom-metrics presenter parity pending. |

## Completion Check
- Route spine coverage for planned M5 set: **Complete**
- Scoped data wiring for M5.3 targets: **Complete**
- Full presenter parity with `apps/web` project pages: **Not complete**

## Blocking Gaps Before Migration Completion Gate
1. Strict project scoping consistency across all helper fetches.
2. Project-specific presenter parity for:
   - custom metrics management
   - guardrail policy/event detail
   - deployment detail correlation
3. Remaining project routes still deferred:
   - `/projects/[projectId]/ingestion`
   - `/projects/[projectId]/processors`
   - `/projects/[projectId]/regressions`
   - `/projects/[projectId]/reliability`
   - `/projects/[projectId]/settings`
   - `/projects/[projectId]/timeline`

## Decision
M5 project-scoped migration remains **Partial** and should continue as migration slices only.

No Phase 9 net-new capability work should proceed on project surfaces until `docs/pulse-migration-completion-gate.md` is satisfied.
