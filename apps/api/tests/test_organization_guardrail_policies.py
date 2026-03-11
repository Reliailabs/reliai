from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from app.models.environment import Environment
from app.models.organization_guardrail_policy import OrganizationGuardrailPolicy
from app.services.trace_warehouse import TraceWarehouseEventRow
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, sign_in


def _seed_project(client, db_session, *, slug: str):
    operator = create_operator(db_session, email=f"{slug}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name=f"{slug} Org", slug=slug)
    project = create_project(client, session_payload, organization["id"], name=f"{slug} Project")
    environment = db_session.scalar(
        db_session.query(Environment).filter(Environment.project_id == UUID(project["id"])).statement
    )
    assert environment is not None
    return session_payload, organization, project, environment


def test_org_policies_endpoint_returns_active_policies_for_operator(client, db_session):
    session_payload, organization, _, _ = _seed_project(client, db_session, slug="org-policy-operator")
    db_session.add_all(
        [
            OrganizationGuardrailPolicy(
                organization_id=UUID(organization["id"]),
                policy_type="structured_output",
                config_json={"retry_limit": 2},
                enforcement_mode="enforce",
                enabled=True,
            ),
            OrganizationGuardrailPolicy(
                organization_id=UUID(organization["id"]),
                policy_type="cost_budget",
                config_json={"max_cost_usd": 0.05},
                enforcement_mode="warn",
                enabled=False,
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/organizations/{organization['id']}/policies",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["policy_type"] for item in payload["items"]] == ["structured_output"]
    assert payload["items"][0]["enforcement_mode"] == "enforce"


def test_org_policies_endpoint_allows_project_api_key(client, db_session):
    session_payload, organization, project, _ = _seed_project(client, db_session, slug="org-policy-api-key")
    api_key = create_api_key(client, session_payload, project["id"])
    db_session.add(
        OrganizationGuardrailPolicy(
            organization_id=UUID(organization["id"]),
            policy_type="latency_retry",
            config_json={"max_latency_ms": 1500, "retry_limit": 1},
            enforcement_mode="block",
            enabled=True,
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/organizations/{organization['id']}/policies",
        headers={"X-API-Key": api_key["api_key"]},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["policy_type"] == "latency_retry"


def test_org_policies_endpoint_is_tenant_safe_for_api_keys(client, db_session):
    session_one, organization_one, project_one, _ = _seed_project(client, db_session, slug="org-policy-safe-one")
    _, organization_two, _, _ = _seed_project(client, db_session, slug="org-policy-safe-two")
    api_key = create_api_key(client, session_one, project_one["id"])

    response = client.get(
        f"/api/v1/organizations/{organization_two['id']}/policies",
        headers={"X-API-Key": api_key["api_key"]},
    )

    assert response.status_code == 403


def test_policy_violation_endpoint_publishes_event(client, db_session, fake_event_stream):
    session_payload, _, project, _ = _seed_project(client, db_session, slug="policy-violation-event")
    api_key = create_api_key(client, session_payload, project["id"])

    response = client.post(
        "/api/v1/runtime/policy-violations",
        headers={"X-API-Key": api_key["api_key"]},
        json={
            "trace_id": "trace-123",
            "policy_type": "structured_output",
            "enforcement_mode": "block",
            "action_taken": "block_response",
            "provider_model": "gpt-4.1",
            "latency_ms": 812,
            "metadata_json": {"reason": "invalid_structured_output"},
        },
    )

    assert response.status_code == 202
    messages = list(fake_event_stream.consume("trace_events"))
    assert len(messages) == 1
    assert messages[0].payload["event_type"] == "policy_violation"
    assert messages[0].payload["policy_type"] == "structured_output"
    assert messages[0].payload["metadata"]["reason"] == "invalid_structured_output"


def test_control_panel_includes_guardrail_compliance(client, db_session, fake_event_stream, fake_trace_warehouse, monkeypatch):
    now = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.reliability_control_panel._utc_now", lambda: now)
    session_payload, organization, project, environment = _seed_project(
        client,
        db_session,
        slug="org-policy-compliance",
    )
    api_key = create_api_key(client, session_payload, project["id"])
    db_session.add(
        OrganizationGuardrailPolicy(
            organization_id=UUID(organization["id"]),
            policy_type="structured_output",
            config_json={"retry_limit": 1},
            enforcement_mode="enforce",
            enabled=True,
        )
    )
    db_session.commit()

    fake_trace_warehouse.insert_trace_events(
        [
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=2),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=environment.id,
                storage_trace_id=UUID("11111111-1111-4111-8111-111111111111"),
                trace_id="trace-ok",
                success=True,
                model_provider="openai",
                model_family="gpt-4.1",
                model_revision="2026-03",
                prompt_version_id="pv_1",
                latency_ms=400,
                input_tokens=120,
                output_tokens=48,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                metadata_json={},
            ),
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=1),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=environment.id,
                storage_trace_id=UUID("22222222-2222-4222-8222-222222222222"),
                trace_id="trace-bad",
                success=True,
                model_provider="openai",
                model_family="gpt-4.1",
                model_revision="2026-03",
                prompt_version_id="pv_1",
                latency_ms=530,
                input_tokens=120,
                output_tokens=52,
                cost_usd=Decimal("0.01"),
                structured_output_valid=False,
                metadata_json={},
            ),
        ]
    )

    violation_response = client.post(
        "/api/v1/runtime/policy-violations",
        headers={"X-API-Key": api_key["api_key"]},
        json={
            "trace_id": "trace-bad",
            "policy_type": "structured_output",
            "enforcement_mode": "enforce",
            "action_taken": "retry",
            "metadata_json": {"reason": "invalid_structured_output"},
        },
    )
    assert violation_response.status_code == 202

    response = client.get(
        f"/api/v1/projects/{project['id']}/control-panel",
        headers=auth_headers(session_payload),
    )

    assert response.status_code == 200
    compliance = response.json()["guardrail_compliance"]
    assert len(compliance) == 1
    assert compliance[0]["policy_type"] == "structured_output"
    assert compliance[0]["coverage_pct"] == 50.0
    assert compliance[0]["violation_count"] == 1
