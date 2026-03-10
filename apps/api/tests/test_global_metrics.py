from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.models.evaluation import Evaluation
from app.models.global_model_reliability import GlobalModelReliability
from app.models.trace import Trace
from app.services.evaluations import STRUCTURED_VALIDITY_EVAL_TYPE
from app.services.global_metrics import (
    METRIC_AVERAGE_LATENCY_MS,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    METRIC_SUCCESS_RATE,
)
from app.workers.global_metrics_aggregator import run_global_metrics_aggregation_for_session
from .test_api import (
    create_api_key,
    create_operator,
    create_organization,
    create_project,
    ingest_trace,
    sign_in,
)


def _seed_global_metric_inputs(client, db_session):
    operator = create_operator(db_session, email="global-metrics-owner@acme.test")
    session_payload = sign_in(client, email=operator.email)
    org_one = create_organization(client, session_payload, name="Global One", slug="global-one")
    project_one = create_project(client, session_payload, org_one["id"], name="Project One")
    key_one = create_api_key(client, session_payload, project_one["id"])

    org_two = create_organization(client, session_payload, name="Global Two", slug="global-two")
    project_two = create_project(client, session_payload, org_two["id"], name="Project Two")
    key_two = create_api_key(client, session_payload, project_two["id"])

    trace_ids: list[UUID] = []
    for payload, api_key in (
        (
            {
                "timestamp": "2026-03-10T10:00:00Z",
                "request_id": "gm-1",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "{\"ok\":true}",
                "latency_ms": 200,
                "prompt_tokens": 40,
                "completion_tokens": 10,
                "total_cost_usd": "0.010000",
                "success": True,
                "metadata_json": {"expected_output_format": "json", "private_note": "hidden"},
            },
            key_one["api_key"],
        ),
        (
            {
                "timestamp": "2026-03-10T10:01:00Z",
                "request_id": "gm-2",
                "model_name": "gpt-4.1-mini",
                "model_provider": "openai",
                "prompt_version": "v1",
                "output_text": "not-json",
                "latency_ms": 400,
                "prompt_tokens": 45,
                "completion_tokens": 12,
                "total_cost_usd": "0.015000",
                "success": False,
                "error_type": "provider_error",
                "metadata_json": {"expected_output_format": "json", "private_note": "hidden"},
            },
            key_two["api_key"],
        ),
        (
            {
                "timestamp": "2026-03-10T10:02:00Z",
                "request_id": "gm-3",
                "model_name": "claude-3-5-sonnet",
                "model_provider": "anthropic",
                "prompt_version": "v1",
                "output_text": "{\"ok\":true}",
                "latency_ms": 250,
                "prompt_tokens": 35,
                "completion_tokens": 14,
                "total_cost_usd": "0.020000",
                "success": True,
                "metadata_json": {"expected_output_format": "json", "private_note": "hidden"},
            },
            key_two["api_key"],
        ),
    ):
        response = ingest_trace(client, api_key, payload)
        trace_ids.append(UUID(response["trace_id"]))

    db_session.add_all(
        [
            Evaluation(
                trace_id=trace_ids[0],
                project_id=db_session.get(Trace, trace_ids[0]).project_id,
                eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
                label="pass",
                explanation="valid",
            ),
            Evaluation(
                trace_id=trace_ids[1],
                project_id=db_session.get(Trace, trace_ids[1]).project_id,
                eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
                label="fail",
                explanation="invalid",
            ),
            Evaluation(
                trace_id=trace_ids[2],
                project_id=db_session.get(Trace, trace_ids[2]).project_id,
                eval_type=STRUCTURED_VALIDITY_EVAL_TYPE,
                label="pass",
                explanation="valid",
            ),
        ]
    )
    db_session.commit()


def test_global_metrics_aggregation_is_privacy_safe(client, db_session, fake_queue):
    _seed_global_metric_inputs(client, db_session)
    run_global_metrics_aggregation_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 11, 0, tzinfo=timezone.utc).isoformat(),
    )

    rows = db_session.scalars(select(GlobalModelReliability)).all()
    assert rows
    success_row = db_session.scalar(
        select(GlobalModelReliability).where(
            GlobalModelReliability.provider == "openai",
            GlobalModelReliability.model_name == "gpt-4.1-mini",
            GlobalModelReliability.metric_name == METRIC_SUCCESS_RATE,
        )
    )
    assert success_row is not None
    assert success_row.metric_value == 0.5
    assert success_row.sample_size == 2
    assert not hasattr(success_row, "project_id")
    assert not hasattr(success_row, "organization_id")


def test_public_model_reliability_leaderboard_returns_aggregates_only(client, db_session, fake_queue):
    _seed_global_metric_inputs(client, db_session)
    run_global_metrics_aggregation_for_session(
        db_session,
        anchor_time=datetime(2026, 3, 10, 11, 0, tzinfo=timezone.utc).isoformat(),
    )

    response = client.get("/api/v1/models/reliability")
    assert response.status_code == 200
    payload = response.json()
    openai_row = next(item for item in payload["items"] if item["model_name"] == "gpt-4.1-mini")
    metric_names = {metric["metric_name"] for metric in openai_row["metrics"]}
    assert metric_names == {
        METRIC_SUCCESS_RATE,
        METRIC_AVERAGE_LATENCY_MS,
        METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    }
    assert "project_id" not in openai_row
    assert "organization_id" not in openai_row
