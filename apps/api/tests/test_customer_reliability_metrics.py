from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from app.models.event_processing_metric import EventProcessingMetric
from app.models.external_processor import ExternalProcessor
from app.models.guardrail_runtime_event import GuardrailRuntimeEvent
from app.models.incident import Incident
from app.models.processor_failure import ProcessorFailure
from app.models.project import Project
from app.schemas.deployment import DeploymentCreate
from app.schemas.guardrail import GuardrailPolicyCreate
from app.services.deployments import create_deployment
from app.services.guardrails import create_guardrail_policy
from app.services.trace_warehouse import TraceWarehouseEventRow
from .test_api import auth_headers, create_operator, create_organization, create_project, sign_in


def _seed_customer_project(client, db_session, *, suffix: str):
    operator = create_operator(
        db_session,
        email=f"customers-{suffix}@acme.test",
        is_system_admin=True,
    )
    session = sign_in(client, email=operator.email)
    organization = create_organization(
        client,
        session,
        name=f"Customers Org {suffix}",
        slug=f"customers-org-{suffix}",
    )
    project = create_project(
        client,
        session,
        organization["id"],
        name=f"Customer Project {suffix}",
    )
    return session, organization, project


def test_system_customers_endpoint_aggregates_project_health(client, db_session, fake_trace_warehouse, monkeypatch):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_reliability_metrics._utc_now", lambda: now)

    session_payload, organization, project = _seed_customer_project(client, db_session, suffix="aggregate")
    second_project = create_project(
        client,
        session_payload,
        organization["id"],
        name="Customer Project quiet",
    )
    project_environment_id = UUID(project["environments"][0]["id"])
    second_project_environment_id = UUID(second_project["environments"][0]["id"])

    chart_rows = []
    for offset in range(18):
        chart_rows.append(
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=12) + timedelta(minutes=offset),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=project_environment_id,
                storage_trace_id=uuid4(),
                trace_id=str(uuid4()),
                success=True,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id="v1",
                input_tokens=20,
                output_tokens=10,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                retrieval_latency_ms=40,
                retrieval_chunks=3,
                metadata_json={"__model_name": "gpt-4.1-mini", "__prompt_version": "v1"},
            )
        )
    for offset in range(4):
        chart_rows.append(
            TraceWarehouseEventRow(
                timestamp=now - timedelta(hours=36) + timedelta(minutes=offset),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=project_environment_id,
                storage_trace_id=uuid4(),
                trace_id=str(uuid4()),
                success=True,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id="v1",
                input_tokens=20,
                output_tokens=10,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                retrieval_latency_ms=40,
                retrieval_chunks=3,
                metadata_json={"__model_name": "gpt-4.1-mini", "__prompt_version": "v1"},
            )
        )
    chart_rows.append(
        TraceWarehouseEventRow(
            timestamp=now - timedelta(hours=8),
            organization_id=UUID(organization["id"]),
            project_id=UUID(second_project["id"]),
            environment_id=second_project_environment_id,
            storage_trace_id=uuid4(),
            trace_id=str(uuid4()),
            success=True,
            model_provider="openai",
            model_family="gpt-4.1-mini",
            model_revision="2026-03",
            prompt_version_id="v1",
            input_tokens=10,
            output_tokens=5,
            cost_usd=Decimal("0.01"),
            structured_output_valid=True,
            retrieval_latency_ms=30,
            retrieval_chunks=2,
            metadata_json={"__model_name": "gpt-4.1-mini", "__prompt_version": "v1"},
        )
    )
    fake_trace_warehouse.insert_trace_events(chart_rows)

    project_model = db_session.get(Project, UUID(project["id"]))

    policy = create_guardrail_policy(
        db_session,
        project=project_model,
        payload=GuardrailPolicyCreate(
            policy_type="structured_output",
            environment="prod",
            config_json={"action": "retry", "require_json": True},
            is_active=True,
        ),
    )

    db_session.add(
        GuardrailRuntimeEvent(
            trace_id=uuid4(),
            environment_id=policy.environment_id,
            policy_id=policy.id,
            action_taken="retry",
            provider_model="gpt-4.1-mini",
            latency_ms=1100,
            metadata_json={"reason": "invalid_json_output"},
            created_at=now - timedelta(hours=4),
        )
    )
    db_session.add(
        Incident(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            environment_id=policy.environment_id,
            incident_type="structured_output_regression",
            severity="high",
            title="Structured output invalid rate spiked",
            status="open",
            fingerprint="customer-health-incident",
            summary_json={"metric_name": "structured_output_validity_rate"},
            started_at=now - timedelta(hours=3),
            updated_at=now - timedelta(hours=2),
        )
    )
    processor = ExternalProcessor(
        project_id=UUID(project["id"]),
        name="Ops webhook",
        event_type="trace_evaluated",
        endpoint_url="https://processor.acme.test/hook",
        secret="processor-secret",
        enabled=True,
    )
    db_session.add(processor)
    db_session.flush()
    db_session.add(
        ProcessorFailure(
            external_processor_id=processor.id,
            project_id=UUID(project["id"]),
            event_type="trace_evaluated",
            attempts=4,
            payload_json={"trace_id": "failure-trace"},
            last_error="timeout",
            created_at=now - timedelta(hours=2),
        )
    )
    db_session.add(
        EventProcessingMetric(
            consumer_name="trace_warehouse_consumer",
            topic="trace_events",
            events_processed=0,
            processing_latency_ms=0,
            error_count=1,
            created_at=now - timedelta(minutes=30),
        )
    )
    db_session.commit()

    response = client.get("/api/v1/system/customers", headers=auth_headers(session_payload))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["projects"]) == 2
    top_project = payload["projects"][0]
    assert top_project["project_id"] == project["id"]
    assert top_project["trace_volume_24h"] == 18
    assert top_project["processor_failures"] == 1
    assert top_project["risk_level"] in {"medium", "high"}


def test_system_customer_detail_endpoint_is_operator_scoped(client, db_session, fake_trace_warehouse, fake_event_stream, monkeypatch):
    now = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("app.services.customer_reliability_metrics._utc_now", lambda: now)

    session_payload, organization, project = _seed_customer_project(client, db_session, suffix="detail")
    other_operator = create_operator(
        db_session,
        email="customers-detail-other@acme.test",
        is_system_admin=False,
    )
    other_session = sign_in(client, email=other_operator.email)
    project_environment_id = UUID(project["environments"][0]["id"])

    fake_trace_warehouse.insert_trace_events(
        [
            TraceWarehouseEventRow(
                timestamp=now - timedelta(days=1),
                organization_id=UUID(organization["id"]),
                project_id=UUID(project["id"]),
                environment_id=project_environment_id,
                storage_trace_id=uuid4(),
                trace_id=str(uuid4()),
                success=True,
                model_provider="openai",
                model_family="gpt-4.1-mini",
                model_revision="2026-03",
                prompt_version_id="v1",
                input_tokens=10,
                output_tokens=5,
                cost_usd=Decimal("0.01"),
                structured_output_valid=True,
                retrieval_latency_ms=30,
                retrieval_chunks=2,
                metadata_json={"__model_name": "gpt-4.1-mini", "__prompt_version": "v1"},
            )
        ]
    )

    project_model = db_session.get(Project, UUID(project["id"]))
    deployment = create_deployment(
        db_session,
        project_id=UUID(project["id"]),
        payload=DeploymentCreate(
            environment="prod",
            deployed_by="release-bot",
            deployed_at=now - timedelta(hours=6),
            metadata_json={"sha": "abc123"},
        ),
    )
    assert project_model is not None
    policy = create_guardrail_policy(
        db_session,
        project=project_model,
        payload=GuardrailPolicyCreate(
            policy_type="structured_output",
            environment="prod",
            config_json={"action": "retry", "require_json": True},
            is_active=True,
        ),
    )
    processor = ExternalProcessor(
        project_id=UUID(project["id"]),
        name="Ops webhook",
        event_type="trace_evaluated",
        endpoint_url="https://processor.acme.test/hook",
        secret="processor-secret",
        enabled=True,
    )
    db_session.add(processor)
    db_session.flush()
    db_session.add(
        GuardrailRuntimeEvent(
            trace_id=uuid4(),
            environment_id=policy.environment_id,
            policy_id=policy.id,
            action_taken="retry",
            provider_model="gpt-4.1-mini",
            latency_ms=900,
            metadata_json={"reason": "invalid_json_output"},
            created_at=now - timedelta(hours=4),
        )
    )
    db_session.add(
        Incident(
            organization_id=UUID(organization["id"]),
            project_id=UUID(project["id"]),
            environment_id=policy.environment_id,
            deployment_id=deployment.id,
            incident_type="structured_output_regression",
            severity="medium",
            title="Structured output invalid rate spiked",
            status="open",
            fingerprint="customer-detail-incident",
            summary_json={"metric_name": "structured_output_validity_rate"},
            started_at=now - timedelta(hours=3),
            updated_at=now - timedelta(hours=2),
        )
    )
    db_session.add(
        ProcessorFailure(
            external_processor_id=processor.id,
            project_id=UUID(project["id"]),
            event_type="trace_evaluated",
            attempts=4,
            payload_json={"trace_id": "failure-trace"},
            last_error="timeout",
            created_at=now - timedelta(hours=1),
        )
    )
    db_session.commit()

    detail_response = client.get(
        f"/api/v1/system/customers/{project['id']}",
        headers=auth_headers(session_payload),
    )
    forbidden_response = client.get(
        f"/api/v1/system/customers/{project['id']}",
        headers=auth_headers(other_session),
    )

    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert payload["project"]["project_id"] == project["id"]
    assert len(payload["trace_volume_chart"]) == 7
    assert payload["guardrail_triggers"][0]["policy_type"] == "structured_output"
    assert payload["incident_history"][0]["title"] == "Structured output invalid rate spiked"
    assert payload["deployment_changes"][0]["deployment_id"] == str(deployment.id)
    assert payload["processor_failures"][0]["processor_name"] == "Ops webhook"
    assert forbidden_response.status_code == 403
