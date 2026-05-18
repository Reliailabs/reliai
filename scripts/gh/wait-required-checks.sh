#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required" >&2
  exit 1
fi

if [[ $# -gt 0 && "$1" == "--" ]]; then
  shift
fi

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <pr-number> [check-name ...]" >&2
  echo "example: $0 242 pulse-route-gate operator-smoke" >&2
  exit 1
fi

PR_NUMBER="$1"
shift || true

if [[ $# -gt 0 ]]; then
  REQUIRED_CHECKS=("$@")
else
  REQUIRED_CHECKS=("pulse-route-gate" "operator-smoke")
fi

echo "Watching PR #${PR_NUMBER} for required checks: ${REQUIRED_CHECKS[*]}"

gh pr checks "${PR_NUMBER}" --watch --interval 10

all_green=true
for check in "${REQUIRED_CHECKS[@]}"; do
  state="$(gh pr checks "${PR_NUMBER}" --json name,state --jq ".[] | select(.name == \"${check}\") | .state" | head -n1)"
  if [[ -z "$state" ]]; then
    echo "missing required check: $check" >&2
    all_green=false
    continue
  fi
  if [[ "$state" != "SUCCESS" ]]; then
    echo "required check not green: $check ($state)" >&2
    all_green=false
  fi
done

if [[ "$all_green" != true ]]; then
  echo "One or more required checks are not green." >&2
  exit 2
fi

echo "All required checks are green for PR #${PR_NUMBER}."
