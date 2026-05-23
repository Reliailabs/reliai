# Pulse Auth Callback Ownership (F4)

Status: closed (externalized ownership with Pulse shim)

## Ownership decision

- WorkOS callback ownership is externalized to `apps/web`.
- Canonical callback route: `apps/web/app/auth/callback/route.ts` (`/auth/callback`).
- Pulse owns an explicit compatibility shim route at:
  - `apps/pulse/app/auth/callback/route.ts`
  - shim forwards callback query to configured external callback target
  - fallback behavior: redirects to `/sign-in?error=sso_callback_unavailable` when callback target is missing/invalid/looping
- Pulse currently owns local operator dev-auth session flow via:
  - `apps/pulse/app/sign-in/page.tsx`
  - `apps/pulse/app/api/auth/dev-sign-in/route.ts`
  - `apps/pulse/app/api/auth/sign-out/route.ts`

## Contract boundary

- Pulse must not silently claim SSO callback execution ownership while callback execution remains externalized.
- Pulse must forward callback requests explicitly instead of leaving route behavior undefined.
- Externalized ownership is accepted for F4 because compatibility behavior is now explicit and test-gated.

## Failure behavior

- If WorkOS redirect/callback is required, canonical ownership remains `apps/web` callback handling.
- Pulse sign-in remains local dev-auth flow and does not process WorkOS callback tokens locally.
- Pulse callback shim depends on:
  - `NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL` pointing to external `/auth/callback`
  - rejecting same-origin callback target to prevent redirect loops.
