from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from app.models.guardrail_policy import GuardrailPolicy
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.services.trace_warehouse import TraceWarehouseEventRow
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _seed_growth_operator(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"growth-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    return session_payload


def test_system_growth_endpoint_aggregates_warehouse_incident_and_guardrail_metrics(
    client,
    db_session,
    fake_trace_warehouse,
    monkeypatch,
):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.growth_metrics._utc_now", lambda: now)
    monkeypatch.setattr("app.services.growth_metrics.USAGE_TIER_UNDER_1M", 10)
    monkeypatch.setattr("app.services.growth_metrics.USAGE_TIER_1M_10M", 20)
    monkeypatch.setattr("app.services.growth_metrics.USAGE_TIER_10M_100M", 30)

    session_payload = _seed_growth_operator(client, db_session, suffix="aggregate")

    org_one = create_organization(client, session_payload, name="Growth Org One", slug="growth-org-one")
    org_two = create_organization(client, session_payload, name="Growth Org Two", slug="growth-org-two")
    project_a = create_project(client, session_payload, org_one["id"], name="Atlas")
    project_b = create_project(client, session_payload, org_one["id"], name="Beacon")
    project_c = create_project(client, session_payload, org_two["id"], name="Comet")
    project_d = create_project(client, session_payload, org_two["id"], name="Delta")

    def add_trace_rows(project: dict, count: int, day: datetime) -> None:
        rows = []
        for index in range(count):
            rows.append(
                TraceWarehouseEventRow(
                    timestamp=day + timedelta(minutes=index),
                    organization_id=UUID(project["organization_id"]),
                    project_id=UUID(project["id"]),
                    environment_id=UUID(project["environments"][0]["id"]),
                    trace_id=uuid4(),
                    prompt_version_id=None,
                    model_version_id=None,
                    latency_ms=200 + index,
                    success=True,
                    error_type=None,
                    input_tokens=20,
                    output_tokens=10,
                    cost_usd=Decimal("0.01"),
                    structured_output_valid=True,
                    retrieval_latency_ms=None,
                    retrieval_chunks=None,
                    metadata_json={"__model_name": "gpt-4.1"},
                )
            )
        fake_trace_warehouse.insert_trace_events(rows)

    for offset, count in enumerate([4, 5, 5, 5, 6, 5, 6]):
        day = datetime(2026, 3, 4 + offset, 12, 0, tzinfo=timezone.utc)
        add_trace_rows(project_a, count, day)

    add_trace_rows(project_b, 12, datetime(2026, 3, 10, 13, 0, tzinfo=timezone.utc))
    add_trace_rows(project_b, 3, datetime(2026, 2, 20, 13, 0, tzinfo=timezone.utc))
    add_trace_rows(project_c, 25, datetime(2026, 2, 25, 14, 0, tzinfo=timezone.utc))
    add_trace_rows(project_d, 35, datetime(2026, 2, 26, 15, 0, tzinfo=timezone.utc))

    policy_a = GuardrailPolicy(
        project_id=UUID(project_a["id"]),
        policy_type="structured_output",
        config_json={"action": "retry"},
        is_active=True,
    )
    policy_b = GuardrailPolicy(
        project_id=UUID(project_b["id"]),
        policy_type="latency_retry",
        config_json={"action": "fallback_model"},
        is_active=True,
    )
    policy_c = GuardrailPolicy(
        project_id=UUID(project_c["id"]),
        policy_type="cost_budget",
        config_json={"action": "block"},
        is_active=True,
    )
    db_session.add_all([policy_a, policy_b, policy_c])
    db_session.flush()

    db_session.add_all(
        [
            Incident(
                organization_id=UUID(org_one["id"]),
                project_id=UUID(project_a["id"]),
                incident_type="latency_spike",
                severity="high",
                title="Latency spike on Atlas",
                status="resolved",
                fingerprint="growth-incident-a",
                summary_json={"metric_name": "latency_ms"},
                started_at=now - timedelta(days=1, hours=2),
                updated_at=now - timedelta(days=1, hours=1, minutes=30),
                resolved_at=now - timedelta(days=1, hours=1, minutes=30),
            ),
            Incident(
                organization_id=UUID(org_two["id"]),
                project_id=UUID(project_c["id"]),
                incident_type="structured_output_regression",
                severity="medium",
                title="Structured output regression on Comet",
                status="open",
                fingerprint="growth-incident-b",
                summary_json={"metric_name": "structured_output_validity_rate"},
                started_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=3),
            ),
        ]
    )
    db_session.add_all(
        [
            GuardrailRuntimeEvent(
                trace_id=uuid4(),
                policy_id=policy_a.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=820,
                created_at=now - timedelta(days=1),
            ),
            GuardrailRuntimeEvent(
                trace_id=uuid4(),
                policy_id=policy_a.id,
                action_taken="retry",
                provider_model="gpt-4.1",
                latency_ms=790,
                created_at=now - timedelta(days=2),
            ),
            GuardrailRuntimeEvent(
                trace_id=uuid4(),
                policy_id=policy_b.id,
                action_taken="fallback_model",
                provider_model="gpt-4.1",
                latency_ms=910,
                created_at=now - timedelta(days=2),
            ),
            GuardrailRuntimeEvent(
                trace_id=uuid4(),
                policy_id=policy_c.id,
                action_taken="block",
                provider_model="gpt-4.1",
                latency_ms=400,
                created_at=now - timedelta(days=4),
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/v1/system/growth", headers=auth_headers(session_payload))

    assert response.status_code == 200
    payload = response.json()
    assert payload["trace_volume"]["today"] == 18
    assert payload["trace_volume"]["seven_day_avg"] == 4
    assert payload["trace_volume"]["growth_pct"] == 320
    assert len(payload["trace_volume"]["daily_points"]) == 7
    assert payload["incident_metrics"]["incidents_detected"] == 2
    assert payload["incident_metrics"]["avg_mttr_minutes"] == 30
    assert payload["guardrail_metrics"] == {"retries": 2, "fallbacks": 1, "blocks": 1}
    assert payload["usage_tiers"] == {
        "under_1m": 0,
        "1m_10m": 1,
        "10m_100m": 1,
        "100m_plus": 2,
    }


def test_system_growth_endpoint_requires_operator_auth(client):
    response = client.get("/api/v1/system/growth")
    assert response.status_code == 401
