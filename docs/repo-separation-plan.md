# Repo Separation Plan

## Goal

Split the current monorepo into a small public Reliai ecosystem under:

- `github.com/reliai/reliai`
- `github.com/reliai/reliai-python`
- `github.com/reliai/reliai-demo`
- `github.com/reliai/reliai-examples`
- `github.com/reliai/reliai-rag-starter`
- `github.com/reliai/reliai-agent-starter`

Deferred:

- `github.com/reliai/reliai-node`

## What stays in `reliai`

Keep the main platform repo as the operational core:

- `apps/web`
- `apps/api`
- `infra`
- `scripts`
- `docs`
- `packages/types`
- `packages/config`
- `packages/runtime-guardrail`
- `packages/runtime-proxy`
- `packages/reliai-node` for the first public wave

## What moves to `reliai-python`

Extract only the Python SDK package and SDK-facing examples:

- `packages/reliai-python/reliai/**`
- `packages/reliai-python/pyproject.toml`

Do not move:

- platform APIs
- warehouse code
- demo fixtures
- web screenshots

## New repos created from scratch

These should be standalone public repos that consume the platform and SDKs:

- `reliai-demo`
- `reliai-examples`
- `reliai-rag-starter`
- `reliai-agent-starter`

## Local scaffolds

The initial public scaffolds live under:

- [`repo-templates/`](/Users/robert/Documents/Reliai/repo-templates)

These are starter repo contents, not active platform runtime code.
