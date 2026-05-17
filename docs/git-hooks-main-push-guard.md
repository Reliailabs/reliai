# Main Push Guard (Local Hook)

This repo includes a local `pre-push` hook at `.githooks/pre-push` that blocks
direct pushes to `main`/`master` by default.

## Install

```bash
pnpm hooks:install
```

This sets:

```bash
git config core.hooksPath .githooks
```

## Default behavior

- `git push origin main` → blocked with an error message.
- Feature branch pushes are allowed.

## Explicit override (emergency only)

```bash
RELIAI_ALLOW_MAIN_PUSH=1 git push origin main
```

Use the override only for true emergency/hotfix scenarios where normal branch +
PR flow is not possible.
