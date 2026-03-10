import json
import subprocess
from pathlib import Path

from .test_api import (
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    sign_in,
    auth_headers,
)


def _seed_runtime_policy_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"runtime-policy-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Runtime Policy Org {suffix}",
        slug=f"runtime-policy-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Runtime Policy Project {suffix}",
    )
    api_key = create_api_key(client, session_payload, project["id"])
    active_policy = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "structured_output",
            "config_json": {"action": "block", "require_json": True},
            "is_active": True,
        },
    )
    inactive_policy = client.post(
        f"/api/v1/projects/{project['id']}/guardrails",
        headers=auth_headers(session_payload),
        json={
            "policy_type": "latency_retry",
            "config_json": {"action": "retry", "max_latency_ms": 900},
            "is_active": False,
        },
    )
    assert active_policy.status_code == 201
    assert inactive_policy.status_code == 201
    return session_payload, project, api_key, active_policy.json(), inactive_policy.json()


def test_runtime_guardrail_policy_fetch_uses_api_key_and_filters_inactive(client, db_session):
    _, _, api_key, active_policy, inactive_policy = _seed_runtime_policy_project(
        client,
        db_session,
        suffix="api",
    )

    response = client.get(
        "/api/v1/runtime/guardrails",
        headers={"X-API-Key": api_key["api_key"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["policies"]) == 1
    assert payload["policies"][0]["id"] == active_policy["id"]
    assert payload["policies"][0]["action"] == "block"
    assert payload["policies"][0]["policy_type"] == "structured_output"
    assert payload["policies"][0]["config"] == {"require_json": True}
    assert payload["policies"][0]["id"] != inactive_policy["id"]


def test_runtime_guardrail_sdk_fetches_and_caches_policies(tmp_path: Path):
    script_path = tmp_path / "runtime_policy_fetch_test.ts"
    script_path.write_text(
        """
import { clearReliaiGuardrailPolicyCache, reliaiLLM } from "/Users/robert/Documents/Reliai/packages/runtime-guardrail/src/index.ts";

async function main() {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          policies: [
            {
              id: "policy-1",
              policy_type: "structured_output",
              action: "block",
              config: { require_json: true }
            }
          ]
        };
      }
    };
  };

  clearReliaiGuardrailPolicyCache();

  const baseInput = {
    projectId: "project-1",
    traceId: "trace-1",
    model: "gpt-4.1",
    prompt: "hello",
    reliaiApiBaseUrl: "https://reliai.test",
    apiKey: "reliai_test_key",
    fetchImpl,
    providerExecutor: async (request) => ({
      model: request.model,
      outputText: "not-json",
      success: true,
      latencyMs: 250,
      totalCostUsd: 0.01,
      metadata: {}
    })
  };

  const first = await reliaiLLM(baseInput);
  const second = await reliaiLLM({ ...baseInput, traceId: "trace-2" });

  console.log(JSON.stringify({
    fetchCount,
    firstBlocked: first.blocked,
    secondBlocked: second.blocked,
    firstDecisions: first.decisions.length,
    secondDecisions: second.decisions.length
  }));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
        """.strip()
    )

    result = subprocess.run(
        ["node", str(script_path)],
        cwd="/Users/robert/Documents/Reliai",
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["fetchCount"] == 1
    assert payload["firstBlocked"] is True
    assert payload["secondBlocked"] is True
    assert payload["firstDecisions"] == 1
    assert payload["secondDecisions"] == 1
