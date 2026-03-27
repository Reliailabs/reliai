# Contributing

Thanks for contributing to Reliai.

## Workflow

1. Fork the repository.
2. Create a branch from `main`.
3. Make the smallest complete change that solves the problem.
4. Run the relevant checks.
5. Submit a pull request with a clear description of the change.

## Local checks

Platform repo:

```bash
pnpm --filter web lint
pnpm --filter web build
python -m pytest apps/api/tests
```

Marketing screenshots:

```bash
pnpm screenshots:marketing
```

## Pull requests

- Keep changes scoped.
- Update docs when behavior changes.
- Do not merge generated screenshots or demo fixtures that do not match the current UI.
