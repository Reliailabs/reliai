# Contributing to Reliai

Thanks for contributing to Reliai.

This repo follows a lightweight operating model designed to keep `main` deployable, changes traceable, and releases safe without slowing down execution.

## Core rules

1. Do not commit directly to `main`.
2. Create a short-lived branch for every task.
3. Merge only after the required validation passes.
4. Keep each branch scoped to one change.
5. Leave the repo production-clean after every merge.
6. Update the changelog for meaningful product or workflow changes.
7. Tag meaningful releases.

## Branch model

### Protected branch

- `main`
  - always deployable
  - expected to pass core checks
  - no direct feature work

### Working branches

Use one of these prefixes:

- `feat/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`
- `docs/<short-description>`
- `refactor/<short-description>`
- `hotfix/<short-description>`

Examples:

- `feat/refusal-rate-incidents`
- `fix/prompt-diff-empty-state`
- `chore/api-dependency-upgrade`
- `docs/demo-script`

## Pull requests

Keep PRs small and focused.

Every PR should answer:

- What changed
- Why it changed
- How it was validated
- Risk / rollback note

## Validation gate

Before requesting merge, run the smallest relevant gate that still proves the change is safe.

### Minimum expected checks

- relevant backend tests
- `pnpm --filter web lint`
- `pnpm --filter web build`

### Additional checks when relevant

- migrations if schema changed
- browser sanity pass if routing/onboarding/demo changed
- contract validation if shared types changed

## Production-clean definition

Reliai is production-clean when:

- `main` passes core checks
- there are no unrelated dirty files
- every shipped change is traceable to a branch or PR
- releases are tagged
- `CHANGELOG.md` is updated for meaningful changes
- hotfixes can be isolated from unfinished work
- no throwaway scripts, test artifacts, or debug logs remain

## Merge checklist

Before merge, confirm:

- branch is up to date with `main`
- no unrelated files are modified
- validation passed
- product copy matches real implementation
- changelog updated if needed
- rollback path is understood
- no temporary files or dead code remain

## Release process

For meaningful releases:

1. merge validated branches into `main`
2. confirm `main` is green
3. update `CHANGELOG.md`
4. create a git tag

Tag format:

- `v0.3.0`
- `v0.3.1`
- `v0.4.0`

## Hotfix workflow

When production credibility or demo reliability is at risk:

1. branch from current `main` or latest release tag
2. isolate only the fix
3. run focused validation
4. merge quickly
5. tag if production state changed
6. update changelog if the fix is externally meaningful

## One-sentence policy

Reliai uses a protected-main, short-lived branch, PR-before-merge workflow with a small validation gate, tagged releases, and strict production-clean discipline.
