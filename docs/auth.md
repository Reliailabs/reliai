# Auth Setup

Reliai supports two auth modes in local development:

1. WorkOS
2. Local dev fallback

The sign-in page shows the active mode based on your environment configuration.

## Local Dev Fallback

Use this when you want the app running without WorkOS.

Required env:

```env
RELIAI_DEV_AUTH_ENABLED=true
```

Seeded local credentials:

- `owner@acme.test`
- `reliai-dev-password`

## WorkOS

WorkOS is enabled only when all of these are set:

```env
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
WORKOS_LOGOUT_REDIRECT_URI=http://127.0.0.1:3000/sign-in
WORKOS_COOKIE_PASSWORD=
WORKOS_SCIM_WEBHOOK_SECRET=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://127.0.0.1:3000/auth/callback
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

Related runtime behavior:

- Web checks WorkOS config in [apps/web/lib/constants.ts](/Users/robert/Documents/Reliai/apps/web/lib/constants.ts)
- Web sign-in flow lives in [apps/web/lib/auth.ts](/Users/robert/Documents/Reliai/apps/web/lib/auth.ts)
- API WorkOS token verification lives in [apps/api/app/services/auth_workos.py](/Users/robert/Documents/Reliai/apps/api/app/services/auth_workos.py)
- API auth mode switching lives in [apps/api/app/services/auth.py](/Users/robert/Documents/Reliai/apps/api/app/services/auth.py)

## Recommended Local Default

For day-to-day repo development:

```env
RELIAI_DEV_AUTH_ENABLED=true
```

Leave WorkOS vars empty unless you are actively testing hosted auth, SCIM, or group-based role mapping.
