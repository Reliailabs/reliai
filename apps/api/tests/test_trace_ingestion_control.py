from uuid import UUID

from app.models.metadata_cardinality import MetadataCardinality
from app.models.trace import Trace
from .test_api import (
    auth_headers,
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def test_project_ingestion_policy_endpoints_are_tenant_safe(client, db_session):
    owner_one = create_operator(db_session, email="ingestion-owner@acme.test")
    owner_two = create_operator(db_session, email="ingestion-outsider@beta.test")
    session_one = sign_in(client, email=owner_one.email)
    session_two = sign_in(client, email=owner_two.email)

    organization = create_organization(client, session_one, name="Acme AI", slug="ingestion-policy-org")
    project = create_project(client, session_one, organization["id"])

    default_response = client.get(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_one),
    )
    assert default_response.status_code == 200
    assert default_response.json()["sampling_success_rate"] == 1.0
    assert default_response.json()["max_cardinality_per_field"] == 250

    update_response = client.put(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_one),
        json={
            "sampling_success_rate": 0.35,
            "sampling_error_rate": 1.0,
            "max_metadata_fields": 12,
            "max_cardinality_per_field": 20,
            "retention_days_success": 7,
            "retention_days_error": 30,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["sampling_success_rate"] == 0.35
    assert update_response.json()["retention_days_success"] == 7

    forbidden_get = client.get(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_two),
    )
    forbidden_put = client.put(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_two),
        json={
            "sampling_success_rate": 1.0,
            "sampling_error_rate": 1.0,
            "max_metadata_fields": 20,
            "max_cardinality_per_field": 50,
            "retention_days_success": 14,
            "retention_days_error": 30,
        },
    )

    assert forbidden_get.status_code == 403
    assert forbidden_put.status_code == 403


def test_ingestion_control_filters_sensitive_metadata_and_caps_cardinality(
    client,
    db_session,
    fake_event_stream,
):
    owner = create_operator(db_session, email="metadata-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Metadata Org", slug="metadata-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    policy_response = client.put(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_payload),
        json={
            "sampling_success_rate": 1.0,
            "sampling_error_rate": 1.0,
            "max_metadata_fields": 2,
            "max_cardinality_per_field": 1,
            "retention_days_success": 14,
            "retention_days_error": 30,
        },
    )
    assert policy_response.status_code == 200

    first = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T15:00:00Z",
            "request_id": "req_ingest_1",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "metadata_json": {
                "a_route": "support",
                "b_password": "customer-secret",
                "c_variant": "rollout-a",
            },
        },
    )
    second = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T15:01:00Z",
            "request_id": "req_ingest_2",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "metadata_json": {
                "a_route": "billing",
                "b_password": "new-secret",
            },
        },
    )

    first_trace = db_session.get(Trace, UUID(first["trace_id"]))
    second_trace = db_session.get(Trace, UUID(second["trace_id"]))
    assert first_trace is not None
    assert second_trace is not None
    assert first_trace.metadata_json == {"a_route": "support", "b_password": "[redacted]"}
    assert second_trace.metadata_json == {"b_password": "[redacted]"}

    tracked = db_session.query(MetadataCardinality).order_by(MetadataCardinality.field_name.asc()).all()
    assert [item.field_name for item in tracked] == ["a_route", "b_password"]
    assert all(item.unique_values_count == 1 for item in tracked)

    policy_read = client.get(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_payload),
    )
    assert policy_read.status_code == 200
    summary = {item["field_name"]: item for item in policy_read.json()["cardinality_summary"]}
    assert summary["a_route"]["limit_reached"] is True
    assert summary["b_password"]["unique_values_count"] == 1

    messages = list(fake_event_stream.consume("trace_events"))
    assert len(messages) == 2


def test_ingestion_sampling_controls_event_publication_without_dropping_trace_rows(
    client,
    db_session,
    fake_event_stream,
):
    owner = create_operator(db_session, email="sampling-owner@acme.test")
    session_payload = sign_in(client, email=owner.email)
    organization = create_organization(client, session_payload, name="Sampling Org", slug="sampling-org")
    project = create_project(client, session_payload, organization["id"])
    api_key = create_api_key(client, session_payload, project["id"])

    update_response = client.put(
        f"/api/v1/projects/{project['id']}/ingestion-policy",
        headers=auth_headers(session_payload),
        json={
            "sampling_success_rate": 0.0,
            "sampling_error_rate": 1.0,
            "max_metadata_fields": 50,
            "max_cardinality_per_field": 250,
            "retention_days_success": 14,
            "retention_days_error": 30,
        },
    )
    assert update_response.status_code == 200

    success_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T16:00:00Z",
            "request_id": "req_success",
            "model_name": "gpt-4.1-mini",
            "success": True,
            "metadata_json": {"route": "support"},
        },
    )
    error_trace = ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T16:01:00Z",
            "request_id": "req_error",
            "model_name": "gpt-4.1-mini",
            "success": False,
            "error_type": "timeout",
            "metadata_json": {"route": "support"},
        },
    )

    assert db_session.get(Trace, UUID(success_trace["trace_id"])) is not None
    assert db_session.get(Trace, UUID(error_trace["trace_id"])) is not None

    messages = list(fake_event_stream.consume("trace_events"))
    assert len(messages) == 1
    assert messages[0].payload["trace_id"] == error_trace["trace_id"]
