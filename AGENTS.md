# Reliai Agent Repo Operating Policy

This file defines the required workflow for all agents making changes to Reliai.

## Purpose

Keep `main` deployable, changes traceable, and releases safe without adding heavyweight process.

## Non-Negotiable Rules

1. Never commit directly to `main`.
2. Create a new branch for every task.
3. Merge only after the required validation passes.
4. Keep branches short-lived and scoped to one change.
5. Leave the repo production-clean after every merge.
6. Add a short merge summary for every merged change.
7. Update the changelog for meaningful product, platform, or workflow changes.
8. Tag releases so production state is always identifiable.
9. Do not mix unrelated fixes or experiments into the same branch.
10. Hotfixes must be isolated from unfinished work.

## Branch Model

Reliai uses a minimal branch model.

### Protected branch

- `main`
  - always deployable
  - always expected to pass core validation
  - no direct feature work
  - no direct commits except true emergency hotfixes, and even then prefer a hotfix branch

### Working branches

Use short-lived branches only.

Allowed patterns:

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
- `hotfix/apply-fix-409`

### Optional release branches

Only add later if needed:

- `release/<version>`

Do not introduce a long-lived `develop` branch.

## Branch Rules

Every branch must:

- solve one problem
- have one clear purpose
- be easy to review and rollback
- avoid bundling unrelated work

Do not stack new work on top of unmerged feature branches unless explicitly required.

If a blocking bug is discovered while working on another feature:

- stop
- create a separate `fix/...` or `hotfix/...` branch from `main`
- land that fix independently

## Required Validation Gate

Before requesting merge, agents must run the smallest relevant gate that still proves the change is safe.

### Minimum required gate

- backend tests relevant to the change
- web lint
- web build

### If backend code changed

Run the strongest practical backend tests for affected areas.

### If shared contracts changed

Validate both backend and frontend consumers.

### If migrations changed

Run migration upgrade locally.

### If routing or onboarding changed

Run a manual or automated browser sanity pass.

## Production-Clean Definition

Reliai is production-clean when all of the following are true:

- `main` passes core checks
- there are no unrelated dirty files
- every shipped change is traceable to a branch or PR
- releases are tagged
- changelog is updated for meaningful changes
- hotfixes can be isolated without dragging unfinished work
- no temporary scripts, test artifacts, or throwaway debug code remain
- no placeholder claims were added to product or marketing surfaces

## Required PR Structure

Every PR must include the following sections:

### 1. What changed

A concise explanation of what was implemented.

### 2. Why it changed

The product, reliability, UX, or operational reason for the change.

### 3. How it was validated

List the exact commands run and summarize the result.

### 4. Risk / rollback note

State the main risk and how to revert or isolate the change if needed.

## PR Size Guidance

Prefer small PRs.

A good PR:

- answers one clear question
- can be reviewed quickly
- has a narrow blast radius

Bad PRs:

- combine feature work and dependency updates
- combine product copy, backend logic, and unrelated cleanup
- include hidden refactors not required for the task

## Merge Checklist

Before merge, agents must confirm all of the following:

- branch is up to date with `main`
- no unrelated files are modified
- validation gate passed
- product copy matches actual implementation
- changelog updated if the change is meaningful
- no debug logs, temporary files, or dead code remain
- rollback path is understood
- merge summary is prepared

## Required Merge Summary

Every merged change must include a short summary in this format:

### Merge Summary
- **What changed:** ...
- **Why:** ...
- **Validation:** ...
- **Risk / rollback:** ...

Keep it short and specific.

## Release Process

Use lightweight releases.

### For every meaningful release

1. merge validated branches into `main`
2. confirm `main` is green
3. update `CHANGELOG.md`
4. create a git tag

Tag format:

- `v0.3.0`
- `v0.3.1`
- `v0.4.0`

### Release notes should include

- summary
- key shipped capabilities
- any important validation note
- known limitations if relevant

## Hotfix Workflow

Use this when production credibility or demo reliability is at risk.

### Steps

1. branch from current `main` or latest release tag
   - `hotfix/<short-description>`
2. isolate only the fix
3. run focused validation
4. merge quickly
5. tag if production state changed
6. update changelog if the fix is externally meaningful

Do not bundle queued feature work into hotfixes.

## Agent Behavior Rules

Agents must:

- prefer the smallest safe change
- preserve deployability
- avoid hidden repo-wide changes
- call out assumptions
- be honest about what was not verified
- keep product, demo, and homepage claims aligned with real implementation

Agents must not:

- push directly to `main` for normal work
- leave dirty files unrelated to the task
- silently change infra or dependencies without noting it
- merge work that has not passed the validation gate
- mix emergency fixes with feature work

## Branch Naming Guidance

Use lowercase kebab-case after the prefix.

Good:

- `feat/behavior-signals-ux`
- `fix/simulation-autostart`
- `chore/ruff-cleanup`

Avoid:

- `newstuff`
- `branch1`
- `finalfix`
- `temp`

## Validation Examples

### Backend-heavy change

- `pytest apps/api/tests/test_behavior_signals.py`
- `pytest apps/api/tests/test_onboarding_and_prompt_diff.py`

### Frontend-heavy change

- `pnpm --filter web lint`
- `pnpm --filter web build`

### Full readiness pass

- relevant backend tests
- migrations if applicable
- web lint
- web build
- browser sanity pass

## Changelog Rule

Update `CHANGELOG.md` when a change affects:

- product capabilities
- user workflow
- onboarding or demo experience
- production behavior
- release credibility

Do not require changelog updates for trivial internal cleanup.

## Standard Operating Rule

If uncertain, choose the path that:

- keeps `main` safest
- reduces blast radius
- preserves rollback simplicity
- makes the change easiest to verify

## One-Sentence Policy

Reliai uses a protected-main, short-lived branch, PR-before-merge workflow with a small validation gate, tagged releases, and strict production-clean discipline.

NOTE: Avoid destructive cleans (e.g., git clean -fdx) because they remove .env and other local secrets. Prefer targeted cleanup and keep .env local (gitignored).
