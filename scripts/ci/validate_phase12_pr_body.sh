#!/usr/bin/env bash
set -euo pipefail

EVENT_NAME="${GITHUB_EVENT_NAME:-}"
HEAD_REF="${GITHUB_HEAD_REF:-}"
PR_BODY="${PR_BODY:-}"

if [[ "$EVENT_NAME" != "pull_request" ]]; then
  echo "phase12-pr-body-check: skip (event=$EVENT_NAME)"
  exit 0
fi

if [[ ! "$HEAD_REF" =~ phase12- ]]; then
  echo "phase12-pr-body-check: skip (branch=$HEAD_REF)"
  exit 0
fi

if [[ -z "$PR_BODY" ]]; then
  echo "phase12-pr-body-check: failed (empty PR body on phase12 branch)"
  exit 1
fi

required_patterns=(
  "Phase12 Follow-up Contract"
  "slice_id"
  "scope"
  "routes_touched"
  "invariants_touched"
  "validation"
  "ci_proof"
  "check_query_evidence"
  "risk_rollback"
)

missing=0
for pattern in "${required_patterns[@]}"; do
  if ! grep -q "$pattern" <<<"$PR_BODY"; then
    echo "phase12-pr-body-check: missing '$pattern'"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "phase12-pr-body-check: failed"
  exit 1
fi

echo "phase12-pr-body-check: passed"
