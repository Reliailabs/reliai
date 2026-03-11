from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.global_reliability_pattern import GlobalReliabilityPattern
from app.models.reliability_pattern import ReliabilityPattern
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.services.global_reliability_patterns import run_global_pattern_mining_for_session
from app.services.trace_warehouse import TraceWarehouseEventRow

from .test_api import auth_headers
from .test_deployment_risk_engine import _seed_risky_deployment_data
from .test_incident_command_center import _seed_incident_with_deployment
from .test_reliability_patterns import _seed_pattern_project


def test_global_pattern_mining_persists_privacy_safe_patterns(client, db_session, fake_trace_warehouse):
    now = datetime(2026, 3, 11, 16, 0, tzinfo=timezone.utc)
    session_payload, organization_one, project_one, _, _ = _seed_pattern_project(client, db_session, suffix="global-a")
    _, organization_two, project_two, _, _ = _seed_pattern_project(client, db_session, suffix="global-b")

    for organization, project in ((organization_one, project_one), (organization_two, project_two)):
        db_session.add(
            ReliabilityPattern(
                pattern_type="model_failure",
                model_family="gpt-4.1-mini",
                prompt_pattern_hash=None,
                failure_type="latency_spike",
                failure_probability=0.42,
                sample_count=18,
                first_seen_at=now - timedelta(days=2),
                last_seen_at=now - timedelta(hours=1),
            )
        )
        fake_trace_warehouse.insert_trace_events(
            [
                TraceWarehouseEventRow(
                    timestamp=now - timedelta(hours=3),
                    organization_id=UUID(organization["id"]),
                    project_id=UUID(project["id"]),
                    environment_id=UUID(project["environments"][0]["id"]),
                    storage_trace_id=uuid4(),
                    trace_id=str(uuid4()),
                    success=False,
                    model_provider="openai",
                    model_family="gpt-4.1-mini",
                    model_revision="2026-03",
                    latency_ms=1820,
                    input_tokens=120,
                    output_tokens=30,
                    cost_usd=Decimal("0.02"),
                    structured_output_valid=False,
                    metadata_json={"expected_output_format": "json"},
                ),
                TraceWarehouseEventRow(
                    timestamp=now - timedelta(hours=2),
                    organization_id=UUID(organization["id"]),
                    project_id=UUID(project["id"]),
                    environment_id=UUID(project["environments"][0]["id"]),
                    storage_trace_id=uuid4(),
                    trace_id=str(uuid4()),
                    success=False,
                    model_provider="openai",
                    model_family="gpt-4.1-mini",
                    model_revision="2026-03",
                    latency_ms=1900,
                    input_tokens=140,
                    output_tokens=35,
                    cost_usd=Decimal("0.03"),
                    structured_output_valid=False,
                    metadata_json={"expected_output_format": "json"},
                ),
            ]
        )
    db_session.commit()

    created = run_global_pattern_mining_for_session(db_session, anchor_time=now.isoformat())
    db_session.commit()
    assert created

    persisted = db_session.scalars(select(GlobalReliabilityPattern)).all()
    assert persisted

    response = client.get("/api/v1/intelligence/global-patterns", headers=auth_headers(session_payload))
    assert response.status_code == 200
    payload = response.json()["patterns"][0]
    assert payload["pattern_id"]
    assert payload["description"]
    assert payload["impact"]
    assert payload["recommended_guardrails"]
    assert payload["organizations_affected"] >= 2
    assert "organization_id" not in str(payload)
    assert "prompt" not in payload["description"].lower()


def test_deployment_risk_includes_global_pattern_risk(client, db_session, fake_queue):
    _, _, _, deployment = _seed_risky_deployment_data(client, db_session)
    from app.models.deployment import Deployment as DeploymentModel

    deployment_row = db_session.get(DeploymentModel, UUID(deployment["id"]))
    assert deployment_row is not None
    model_family = (
        deployment_row.model_version.model_family
        if deployment_row.model_version is not None and deployment_row.model_version.model_family
        else deployment_row.model_version.model_name
        if deployment_row.model_version is not None
        else None
    )
    db_session.add(
        GlobalReliabilityPattern(
            pattern_id="global-latency-risk",
            pattern_type="model_failure",
            conditions_json={"model_family": model_family, "failure_type": "latency_spike"},
            impact_metrics_json={
                "description": f"{model_family} shows repeated latency spike patterns",
                "impact": "12 matching failures across 2 organizations with 42% average failure probability",
                "recommended_guardrails": ["latency_retry"],
            },
            occurrence_count=12,
            organizations_affected=2,
            confidence_score=0.74,
            created_at=datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    risk = calculate_deployment_risk(db_session, deployment_id=UUID(deployment["id"]))

    assert risk.analysis_json["global_pattern_risk"]["risk_score"] > 0
    assert risk.analysis_json["global_pattern_risk"]["patterns"]


def test_incident_command_center_includes_similar_platform_failures(client, db_session, fake_queue):
    owner_session, _, _, incident, _ = _seed_incident_with_deployment(client, db_session)
    db_session.add(
        GlobalReliabilityPattern(
            pattern_id="global-incident-risk",
            pattern_type="model_failure",
            conditions_json={"model_family": "gpt-4.1-mini", "failure_type": "request_failure"},
            impact_metrics_json={
                "description": "gpt-4.1-mini shows elevated request failure patterns",
                "impact": "18 matching failures across 3 organizations with 51% average failure probability",
                "recommended_guardrails": ["structured_output"],
            },
            occurrence_count=18,
            organizations_affected=3,
            confidence_score=0.68,
            created_at=datetime(2026, 3, 11, 15, 0, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/incidents/{incident.id}/command",
        headers=auth_headers(owner_session),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["similar_platform_failures"]
    assert payload["similar_platform_failures"][0]["description"]
