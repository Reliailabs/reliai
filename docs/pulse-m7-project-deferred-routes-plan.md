# Pulse M7 — Deferred Project Routes Parity Plan

## Deferred routes
- `/projects/[projectId]/ingestion`
- `/projects/[projectId]/processors`
- `/projects/[projectId]/regressions`
- `/projects/[projectId]/reliability`

## Reason deferred
These routes require deeper presenter logic not yet mapped into current Pulse section model.

## Migration rule
- Add route stubs under auth first.
- Inject source-backed project context.
- Add parity notices until full presenter parity is reached.
- No route dropped; no dead links.

## Validation
- lint/build + route smoke + source contract check against `apps/web/lib/api.ts`.
