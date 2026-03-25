#!/usr/bin/env python3
"""Dev smoke test for onboarding simulation create/poll flow.

Usage:
  python scripts/smoke_onboarding_simulation.py --email owner@acme.test --password reliai-test-password
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class HttpResult:
    status: int
    payload: dict[str, Any]


def _request_json(
    *,
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> HttpResult:
    body_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url=url, method=method, data=body_bytes, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = response.read().decode("utf-8")
            parsed = json.loads(data) if data else {}
            return HttpResult(status=response.status, payload=parsed)
    except urllib.error.HTTPError as exc:
        data = exc.read().decode("utf-8")
        parsed: dict[str, Any]
        try:
            parsed = json.loads(data) if data else {}
        except json.JSONDecodeError:
            parsed = {"detail": data or f"HTTP {exc.code}"}
        return HttpResult(status=exc.code, payload=parsed)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-check onboarding simulation create/poll flow")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API base URL")
    parser.add_argument("--email", required=True, help="Operator email for /auth/sign-in")
    parser.add_argument("--password", required=True, help="Operator password for /auth/sign-in")
    parser.add_argument("--project-name", default="smoke-onboarding-sim", help="Project name for simulation")
    parser.add_argument("--model-name", default="gpt-4.1-mini", help="Model name seed")
    parser.add_argument("--prompt-type", default="support_triage", help="Prompt type seed")
    parser.add_argument("--simulation-type", default="refusal_spike", help="Simulation type")
    parser.add_argument("--timeout-seconds", type=int, default=360, help="Polling timeout")
    parser.add_argument("--poll-interval-seconds", type=float, default=2.5, help="Polling interval")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    base_url = args.base_url.rstrip("/")

    sign_in = _request_json(
        method="POST",
        url=f"{base_url}/api/v1/auth/sign-in",
        payload={"email": args.email, "password": args.password},
    )
    if sign_in.status != 200:
        print(f"[smoke] sign-in failed ({sign_in.status}): {sign_in.payload}")
        return 1

    token = str(sign_in.payload.get("session_token") or "")
    if not token:
        print("[smoke] sign-in succeeded but no session_token was returned")
        return 1

    create = _request_json(
        method="POST",
        url=f"{base_url}/api/v1/onboarding/simulations",
        token=token,
        payload={
            "project_name": args.project_name,
            "model_name": args.model_name,
            "prompt_type": args.prompt_type,
            "simulation_type": args.simulation_type,
        },
    )
    if create.status != 200:
        print(f"[smoke] simulation create failed ({create.status}): {create.payload}")
        return 1

    simulation_id = str(create.payload.get("simulation_id") or "")
    if not simulation_id:
        print(f"[smoke] simulation create returned no simulation_id: {create.payload}")
        return 1

    print(f"[smoke] simulation created: {simulation_id}")
    deadline = time.time() + args.timeout_seconds

    while time.time() < deadline:
        status = _request_json(
            method="GET",
            url=f"{base_url}/api/v1/onboarding/simulations/{simulation_id}/status",
            token=token,
        )
        if status.status != 200:
            print(f"[smoke] status call failed ({status.status}): {status.payload}")
            return 1

        stage = status.payload.get("stage")
        state = status.payload.get("status")
        progress = status.payload.get("progress")
        incident_id = status.payload.get("incident_id")
        print(f"[smoke] status={state} stage={stage} progress={progress}")

        if state == "failed":
            error = status.payload.get("error") or "unknown simulation failure"
            print(f"[smoke] simulation failed: {error}")
            return 1

        if state == "complete":
            if not incident_id:
                print("[smoke] simulation completed but incident_id is missing")
                return 1
            print(f"[smoke] incident created: {incident_id}")
            print(f"[smoke] command center URL: {base_url.replace(':8000', ':3000')}/incidents/{incident_id}/command")
            return 0

        time.sleep(args.poll_interval_seconds)

    print(f"[smoke] timed out waiting for completion after {args.timeout_seconds}s")
    return 2


if __name__ == "__main__":
    sys.exit(main())
