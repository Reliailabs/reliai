#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="${REPO_ROOT}/.githooks"

if [[ ! -d "${HOOKS_DIR}" ]]; then
  echo "Missing hooks directory: ${HOOKS_DIR}" >&2
  exit 1
fi

git -C "${REPO_ROOT}" config core.hooksPath .githooks
echo "Configured core.hooksPath=.githooks"
