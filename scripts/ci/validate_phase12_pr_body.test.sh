#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate_phase12_pr_body.sh"

run_should_pass() {
  local name="$1"
  shift
  if ! "$@"; then
    echo "FAILED: $name (expected pass)"
    exit 1
  fi
  echo "PASS: $name"
}

run_should_fail() {
  local name="$1"
  shift
  if "$@"; then
    echo "FAILED: $name (expected fail)"
    exit 1
  fi
  echo "PASS: $name"
}

valid_body=$'### Phase12 Follow-up Contract\nslice_id\nscope\nroutes_touched\ninvariants_touched\nvalidation\nci_proof\ncheck_query_evidence\nrisk_rollback'

run_should_pass \
  "skip on push events" \
  env GITHUB_EVENT_NAME=push GITHUB_HEAD_REF=feat/pulse-phase12-1 PR_BODY="" bash "$VALIDATOR"

run_should_pass \
  "skip on non phase12 pull request branch" \
  env GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=feat/non-phase-change PR_BODY="" bash "$VALIDATOR"

run_should_pass \
  "pass when all required fields are present" \
  env GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=feat/pulse-phase12-1 PR_BODY="$valid_body" bash "$VALIDATOR"

run_should_fail \
  "fail on empty body for phase12 branch" \
  env GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=feat/pulse-phase12-1 PR_BODY="" bash "$VALIDATOR"

run_should_fail \
  "fail when required fields are missing" \
  env GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=feat/pulse-phase12-1 PR_BODY="### Phase12 Follow-up Contract\nslice_id" bash "$VALIDATOR"

echo "All validator tests passed."
