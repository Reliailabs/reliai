from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.reliability_pattern import ReliabilityPattern
from app.schemas.deployment import DeploymentCreate
from app.services.deployments import create_deployment
from app.services.reliability_pattern_mining import build_prompt_pattern_hash
from app.services.reliability_recommendations import generate_recommendations
from app.services.trace_warehouse import TraceWarehouseEventRow
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.workers.reliability_pattern_mining import run_reliability_pattern_mining_for_session
from .test_api import auth_headers, create_api_key, create_operator, create_organization, create_project, ingest_trace, sign_in


def _seed_pattern_project(client, db_session, *, suffix: str):
    operator = create_operator(db_session, email=f"patterns-{suffix}@acme.test")
    session_payload = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session_payload,
        name=f"Patterns Org {suffix}",
        slug=f"patterns-org-{suffix}",
    )
    project = create_project(
        client,
        session_payload,
        organization["id"],
        name=f"Patterns Project {suffix}",
    )
    api_key = create_api_key(client, session_payload, project["id"])
    ingest_trace(
        client,
        api_key["api_key"],
        {
            "timestamp": "2026-03-10T10:00:00Z",
            "request_id": f"pattern-seed-{suffix}",
            "model_name": "gpt-4.1-mini",
            "model_provider": "openai",
            "prompt_version": "v1",
            "latency_ms": 180,
            "prompt_tokens": 120,
            "completion_tokens": 30,
            "success": True,
            "output_text": "{\"ok\": true}",
            "metadata_json": {"expected_output_format": "json", "model_version": "2026-03"},
        },
    )
    prompt_versions = client.get(
        f"/api/v1/projects/{project['id']}/prompt-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    model_versions = client.get(
        f"/api/v1/projects/{project['id']}/model-versions",
        headers=auth_headers(session_payload),
    ).json()["items"]
    return session_payload, organization, project, prompt_versions[0], model_versions[0]


def test_reliability_pattern_mining_persists_rows_and_operator_endpoints(
    client,
    db_session,
    fake_trace_warehouse,
):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    session_payload, organization, project, _, _ = _seed_pattern_project(client, db_session, suffix="aggregate")
    environment_id = UUID(project["environments"][0]["id"])

    fake_trace_warehouse.insert_trace_events(
        [
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=2),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=environment_id,
                trace_id=uuid4(),
                success=False,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id=project["id"],
                latency_ms=1800,
                input_tokens=220,
                output_tokens=40,
                cost_usd=Decimal("0.01"),
                structured_output_valid=False,
                retrieval_latency_ms=1400,
                retrieval_chunks=0,
                metadata_json={"expected_output_format": "json"},
            ),
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=1),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=environment_id,
                trace_id=uuid4(),
                success=False,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id=project["id"],
                latency_ms=1600,
                input_tokens=240,
                output_tokens=42,
                cost_usd=Decimal("0.01"),
                structured_output_valid=False,
                retrieval_latency_ms=1300,
                retrieval_chunks=1,
                metadata_json={"expected_output_format": "json"},
            ),
            TraceWarehouseEventRow(
                timestamp=now - timedelta(minutes=30),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=environment_id,
                trace_id=uuid4(),
                success=True,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id=project["id"],
                latency_ms=300,
                input_tokens=120,
                output_tokens=28,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                retrieval_latency_ms=120,
                retrieval_chunks=4,
                metadata_json={"expected_output_format": "json"},
            ),
        ]
    )

    run_reliability_pattern_mining_for_session(db_session, anchor_time=now.isoformat())

    persisted = db_session.scalars(select(ReliabilityPattern)).all()
    assert persisted
    assert any(item.pattern_type == "retrieval_failure" for item in persisted)

    unauthorized = client.get("/api/v1/intelligence/patterns")
    authorized = client.get("/api/v1/intelligence/patterns", headers=auth_headers(session_payload))

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
    first = authorized.json()["items"][0]
    detail = client.get(
        f"/api/v1/intelligence/patterns/{first['id']}",
        headers=auth_headers(session_payload),
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == first["id"]


def test_deployment_risk_uses_reliability_pattern_risk(client, db_session):
    session_payload, _, project, prompt_version, model_version = _seed_pattern_project(
        client,
        db_session,
        suffix="risk",
    )
    deployment = create_deployment(
        db_session,
        project_id=UUID(project["id"]),
        payload=DeploymentCreate(
            prompt_version_id=UUID(prompt_version["id"]),
            model_version_id=UUID(model_version["id"]),
            environment="prod",
            deployed_by="release-bot",
            deployed_at=datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
            metadata_json={"sha": "abc123"},
        ),
    )
    db_session.add(
        ReliabilityPattern(
            pattern_type="model_failure",
            model_family=model_version["model_family"],
            prompt_pattern_hash=build_prompt_pattern_hash(prompt_version["id"]),
            failure_type="structured_output_invalid",
            failure_probability=0.45,
            sample_count=20,
            first_seen_at=datetime(2026, 3, 4, 18, 0, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 3, 10, 17, 0, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    risk = calculate_deployment_risk(db_session, deployment_id=deployment.id)

    assert risk.risk_score > 0
    assert risk.analysis_json["pattern_risk"]["value"] > 0
    assert risk.analysis_json["pattern_risk"]["matched_patterns"][0]["failure_type"] == "structured_output_invalid"


def test_reliability_recommendations_include_guardrail_intelligence(client, db_session):
    _, _, project, prompt_version, model_version = _seed_pattern_project(
        client,
        db_session,
        suffix="recommendations",
    )
    deployment = create_deployment(
        db_session,
        project_id=UUID(project["id"]),
        payload=DeploymentCreate(
            prompt_version_id=UUID(prompt_version["id"]),
            model_version_id=UUID(model_version["id"]),
            environment="prod",
            deployed_by="release-bot",
            deployed_at=datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
            metadata_json={"sha": "def456"},
        ),
    )
    db_session.add(
        ReliabilityPattern(
            pattern_type="retrieval_failure",
            model_family=model_version["model_family"],
            prompt_pattern_hash=build_prompt_pattern_hash(prompt_version["id"]),
            failure_type="hallucination_risk",
            failure_probability=0.41,
            sample_count=18,
            first_seen_at=datetime(2026, 3, 5, 18, 0, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 3, 10, 16, 0, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    generated = generate_recommendations(db_session, UUID(project["id"]))

    assert deployment.id is not None
    assert any(item.recommendation_type == "guardrail_intelligence" for item in generated)
    guardrail_item = next(item for item in generated if item.recommendation_type == "guardrail_intelligence")
    assert guardrail_item.evidence_json["policy_type"] == "hallucination"
