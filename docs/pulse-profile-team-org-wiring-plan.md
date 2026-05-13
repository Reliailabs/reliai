# Pulse Profile + Team/Org Wiring Plan

## Goal
Fully wire profile settings in Pulse with backend-backed reads/writes while preserving current UI structure.

## Slice A (Current)
- Audit current auth/session/user/org sources.
- Add `GET /api/settings/profile`.
- Add profile repository boundary (fixture + live adapter).
- Wire `/settings#profile` to load from API.
- No write path yet.

## Source of truth audit
- Auth/session contract: `apps/pulse/lib/auth.ts` and `/api/auth/session`.
- Current settings read model: `apps/pulse/lib/settings-data.ts`.
- Upstream live session identity source: `${API_URL}/api/v1/auth/session`.
- Organization context source: session memberships + active organization in `requireOperatorSession`.

## Target profile contract
`GET /api/settings/profile` returns:
- `profile`: `initials`, `firstName`, `lastName`, `email`, `role`
- `organization`: `id` (nullable)
- `dataMode`: `live|demo`
- `sourceErrors`: string[]

## Planned slices
- Slice B: `PATCH /api/settings/profile` + Save button persistence.
- Slice C: Team/Org read surfaces and guards.
- Slice D: parity audit + cleanup + tests.

## Constraints
- No redesign.
- No write path in Slice A.
- No contract-breaking auth changes.
