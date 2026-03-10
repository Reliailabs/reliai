from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.services.evaluations import run_structured_output_validity_evaluation
from app.workers.trace_warehouse_ingest import run_trace_warehouse_ingest
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def test_trace_cohort_endpoint_uses_postgres_for_recent_investigation_windows(
    client,
    db_session,
    fake_queue,
):
    operator = create_operator(db_session, email="cohort-recent@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Cohort Recent", slug="cohort-recent")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    base_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=1)
    for index, success in enumerate((True, False, False)):
        trace = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (base_time + timedelta(minutes=index * 4)).isoformat(),
                "request_id": f"cohort-recent-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}" if success else "not-json",
                "success": success,
                "error_type": None if success else "provider_error",
                "latency_ms": 180 + (index * 300),
                "prompt_tokens": 30,
                "completion_tokens": 12,
                "total_cost_usd": "0.010000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        run_structured_output_validity_evaluation(db_session, UUID(trace["trace_id"]))

    response = client.post(
        f"/api/v1/projects/{project['id']}/trace-cohorts",
        headers=auth_headers(session_payload),
        json={
            "filters": {
                "date_from": (base_time - timedelta(minutes=1)).isoformat(),
                "date_to": (base_time + timedelta(minutes=20)).isoformat(),
                "latency_min_ms": 300,
                "structured_output_valid": False,
            },
            "aggregation": {"sample_limit": 10},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["backend"] == "postgres"
    assert payload["metrics"]["trace_count"] == 2
    assert payload["metrics"]["error_rate"] == 1.0
    assert payload["metrics"]["structured_output_validity"] == 0.0
    assert len(payload["items"]) == 2
    assert all(item["latency_ms"] >= 300 for item in payload["items"])


def test_trace_cohort_endpoint_uses_warehouse_for_old_windows(
    client,
    db_session,
    fake_queue,
    fake_trace_warehouse,
):
    operator = create_operator(db_session, email="cohort-old@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(client, session_payload, name="Cohort Old", slug="cohort-old")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    base_time = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(days=10)
    trace_ids: list[UUID] = []
    for index, success in enumerate((True, False, True)):
        response = ingest_trace(
            client,
            api_key["api_key"],
            {
                "timestamp": (base_time + timedelta(minutes=index * 3)).isoformat(),
                "request_id": f"cohort-old-{index}",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\": true}" if success else "not-json",
                "success": success,
                "error_type": None if success else "provider_error",
                "latency_ms": 220 + (index * 500),
                "prompt_tokens": 30,
                "completion_tokens": 12,
                "total_cost_usd": "0.010000" if success else "0.030000",
                "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
            },
        )
        trace_id = UUID(response["trace_id"])
        trace_ids.append(trace_id)
        run_structured_output_validity_evaluation(db_session, trace_id)
        run_trace_warehouse_ingest(str(trace_id))

    response = client.post(
        f"/api/v1/projects/{project['id']}/trace-cohorts",
        headers=auth_headers(session_payload),
        json={
            "filters": {
                "date_from": (base_time - timedelta(minutes=1)).isoformat(),
                "date_to": (base_time + timedelta(minutes=12)).isoformat(),
                "success": False,
            },
            "aggregation": {"sample_limit": 5},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["backend"] == "warehouse"
    assert payload["metrics"]["trace_count"] == 1
    assert payload["metrics"]["error_rate"] == 1.0
    assert payload["metrics"]["average_cost_usd"] == 0.03
    assert [item["request_id"] for item in payload["items"]] == ["cohort-old-1"]


def test_trace_cohort_endpoint_is_tenant_safe(client, db_session, fake_queue):
    owner = create_operator(db_session, email="cohort-safe-owner@acme.test")
    outsider = create_operator(db_session, email="cohort-safe-outsider@beta.test")
    owner_session = sign_in(client, email=owner.email)
    outsider_session = sign_in(client, email=outsider.email)
    organization = create_organization(client, owner_session, name="Cohort Safe", slug="cohort-safe")
    project = create_project(client, owner_session, organization["id"])

    response = client.post(
        f"/api/v1/projects/{project['id']}/trace-cohorts",
        headers=auth_headers(outsider_session),
        json={
            "filters": {
                "date_from": "2026-03-01T00:00:00Z",
                "date_to": "2026-03-02T00:00:00Z",
            },
            "aggregation": {"sample_limit": 5},
        },
    )

    assert response.status_code == 403
