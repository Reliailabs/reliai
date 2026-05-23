# Pulse Auth Callback Ownership (F4)

Status: open (high-impact parity gap)

## Ownership decision

- WorkOS callback ownership is externalized to `apps/web`.
- Canonical callback route: `apps/web/app/auth/callback/route.ts` (`/auth/callback`).
- Pulse currently owns local operator dev-auth session flow via:
  - `apps/pulse/app/sign-in/page.tsx`
  - `apps/pulse/app/api/auth/dev-sign-in/route.ts`
  - `apps/pulse/app/api/auth/sign-out/route.ts`

## Contract boundary

- Pulse must not silently claim SSO callback ownership while callback execution remains externalized.
- Pulse must not introduce a local `/auth/callback` route unless F4 is explicitly resolved and parity acceptance is updated.
- Functional parity status remains `open` until one of these happens:
  - Pulse implements callback parity behavior, or
  - externalized ownership is permanently accepted with explicit product/ops sign-off.

## Failure behavior

- If WorkOS redirect/callback is required, ownership is `apps/web` callback route handling.
- Pulse sign-in remains local dev-auth flow and does not process WorkOS callback tokens.
