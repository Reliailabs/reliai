from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.api_key import APIKey
from app.models.deployment import Deployment
from app.models.deployment_event import DeploymentEvent
from app.models.deployment_rollback import DeploymentRollback
from app.models.guardrail_policy import GuardrailPolicy
from app.models.operator_user import OperatorUser
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.project import Project
from app.models.trace import Trace
from app.schemas.api_key import APIKeyCreate
from app.schemas.deployment import DeploymentCreate
from app.schemas.guardrail import GuardrailPolicyCreate
from app.schemas.trace import RetrievalSpanIngest, TraceIngestRequest
from app.services.alerts import create_alert_deliveries_for_open_incidents
from app.services.api_keys import create_api_key
from app.services.auth import create_operator_user
from app.services.deployments import create_deployment
from app.services.evaluations import run_structured_output_validity_evaluation
from app.services.guardrails import (
    POLICY_COST_BUDGET,
    POLICY_HALLUCINATION,
    POLICY_LATENCY_RETRY,
    POLICY_STRUCTURED_OUTPUT,
    create_guardrail_policy,
)
from app.services.incidents import sync_incidents_for_scope
from app.services.onboarding import get_or_create_checklist
from app.services.registry import ensure_model_version_record, ensure_prompt_version_record
from app.services.regressions import compute_regressions_for_scope
from app.services.reliability_metrics import compute_project_reliability_metrics
from app.services.rollups import build_scopes
from app.services.traces import create_trace
from app.services.utils import slugify
from app.workers.reliability_sweep import run_reliability_sweep_for_session

SEED_OPERATOR_EMAIL = "owner@acme.test"
SEED_OPERATOR_PASSWORD = "reliai-dev-password"
SEED_REQUEST_PREFIX = "sample-support-agent"
STALE_PROJECT_SLUG = "checkout-assistant"


def _get_or_create_guardrail_policy(
    db,
    *,
    project: Project,
    policy_type: str,
    config_json: dict,
) -> GuardrailPolicy:
    policy = db.scalar(
        select(GuardrailPolicy).where(
            GuardrailPolicy.project_id == project.id,
            GuardrailPolicy.policy_type == policy_type,
        )
    )
    if policy is None:
        return create_guardrail_policy(
            db,
            project=project,
            payload=GuardrailPolicyCreate(
                policy_type=policy_type,
                config_json=config_json,
                is_active=True,
            ),
        )
    policy.config_json = config_json
    policy.is_active = True
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


def _find_seed_deployment(db, *, project: Project, seed_key: str) -> Deployment | None:
    deployments = db.scalars(
        select(Deployment).where(Deployment.project_id == project.id).order_by(Deployment.deployed_at.desc())
    ).all()
    for deployment in deployments:
        if (deployment.metadata_json or {}).get("seed_key") == seed_key:
            return deployment
    return None


def _get_or_create_seed_deployment(
    db,
    *,
    project: Project,
    seed_key: str,
    prompt_version_id,
    model_version_id,
    deployed_at: datetime,
    deployed_by: str,
    metadata_json: dict,
) -> Deployment:
    deployment = _find_seed_deployment(db, project=project, seed_key=seed_key)
    if deployment is not None:
        return deployment
    return create_deployment(
        db,
        project_id=project.id,
        payload=DeploymentCreate(
            prompt_version_id=prompt_version_id,
            model_version_id=model_version_id,
            environment=project.environment,
            deployed_by=deployed_by,
            deployed_at=deployed_at,
            metadata_json={**metadata_json, "seed_key": seed_key},
        ),
    )


def _get_or_create_project(
    db,
    *,
    organization_id,
    name: str,
    slug: str,
    environment: str,
    description: str,
) -> Project:
    project = db.scalar(select(Project).where(Project.slug == slug))
    if project is not None:
        return project
    project = Project(
        organization_id=organization_id,
        name=name,
        slug=slug,
        environment=environment,
        description=description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _get_or_create_seed_rollback(
    db,
    *,
    deployment: Deployment,
    rollback_reason: str,
    rolled_back_at: datetime,
    metadata_json: dict,
) -> DeploymentRollback:
    rollback = db.scalar(
        select(DeploymentRollback).where(
            DeploymentRollback.deployment_id == deployment.id,
            DeploymentRollback.rolled_back_at == rolled_back_at,
        )
    )
    if rollback is None:
        rollback = DeploymentRollback(
            deployment_id=deployment.id,
            rollback_reason=rollback_reason,
            rolled_back_at=rolled_back_at,
        )
        db.add(rollback)
        db.flush()
    existing_event = db.scalar(
        select(DeploymentEvent).where(
            DeploymentEvent.deployment_id == deployment.id,
            DeploymentEvent.event_type == "rollback_completed",
            DeploymentEvent.created_at == rolled_back_at,
        )
    )
    if existing_event is None:
        db.add(
            DeploymentEvent(
                deployment_id=deployment.id,
                event_type="rollback_completed",
                metadata_json=metadata_json,
                created_at=rolled_back_at,
            )
        )
        db.flush()
    db.commit()
    db.refresh(rollback)
    return rollback


def _build_trace_payload(
    *,
    timestamp: datetime,
    request_id: str,
    model_name: str,
    model_provider: str,
    model_version: str,
    prompt_version: str,
    input_text: str,
    output_text: str | None,
    latency_ms: int,
    prompt_tokens: int,
    completion_tokens: int,
    total_cost_usd: str,
    success: bool,
    error_type: str | None,
    retrieval_latency_ms: int,
    source_count: int,
    top_k: int,
    metadata_json: dict,
) -> TraceIngestRequest:
    return TraceIngestRequest(
        timestamp=timestamp,
        request_id=request_id,
        user_id="seed-operator",
        session_id="seed-sample-session",
        model_name=model_name,
        model_provider=model_provider,
        prompt_version=prompt_version,
        input_text=input_text,
        output_text=output_text,
        latency_ms=latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_cost_usd=Decimal(total_cost_usd),
        success=success,
        error_type=error_type,
        metadata_json={
            "seed_data": True,
            "seed_dataset": "support-agent-sample",
            "expected_output_format": "json",
            "structured_output": True,
            "model_version": model_version,
            "model_route": "support-primary",
            **metadata_json,
        },
        retrieval=RetrievalSpanIngest(
            retrieval_latency_ms=retrieval_latency_ms,
            source_count=source_count,
            top_k=top_k,
            query_text=input_text,
            retrieved_chunks_json=[
                {
                    "chunk_id": f"{request_id}-chunk-1",
                    "score": 0.91,
                    "source": "help-center",
                }
            ],
        ),
    )


def _run_signal_pipeline(db, *, project: Project, trace: Trace) -> None:
    run_structured_output_validity_evaluation(db, trace.id)
    opened_incidents = []
    for scope in build_scopes(trace):
        result = compute_regressions_for_scope(db, scope=scope, anchor_time=trace.timestamp)
        sync_result = sync_incidents_for_scope(
            db,
            scope=scope,
            project=project,
            regressions=result.snapshots,
            detected_at=trace.timestamp,
        )
        opened_incidents.extend(sync_result.opened_incidents)
        opened_incidents.extend(sync_result.reopened_incidents)
    create_alert_deliveries_for_open_incidents(db, incidents=opened_incidents)
    compute_project_reliability_metrics(
        db,
        project=project,
        anchor_time=trace.created_at,
        prompt_version_record_id=trace.prompt_version_record_id,
        model_version_record_id=trace.model_version_record_id,
    )
    db.commit()


def _create_trace_if_missing(db, *, project: Project, payload: TraceIngestRequest) -> Trace:
    trace = db.scalar(
        select(Trace).where(
            Trace.project_id == project.id,
            Trace.request_id == payload.request_id,
        )
    )
    if trace is not None:
        return trace
    trace = create_trace(db, project, payload)
    _run_signal_pipeline(db, project=project, trace=trace)
    return trace


def _seed_sample_dataset(db, *, project: Project) -> dict[str, int]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    baseline_start = now - timedelta(hours=2, minutes=20)
    current_start = now - timedelta(minutes=24)
    deployment_time = now - timedelta(minutes=52)

    prompt_v23 = ensure_prompt_version_record(db, project=project, version="v23")
    prompt_v24 = ensure_prompt_version_record(db, project=project, version="v24")
    model_old = ensure_model_version_record(
        db,
        project=project,
        provider="openai",
        model_name="gpt-4.1",
        model_version="2026-01",
        route_key="support-primary",
    )
    model_new = ensure_model_version_record(
        db,
        project=project,
        provider="openai",
        model_name="gpt-4.1",
        model_version="2026-02",
        route_key="support-primary",
    )
    db.commit()

    _get_or_create_guardrail_policy(
        db,
        project=project,
        policy_type=POLICY_STRUCTURED_OUTPUT,
        config_json={"action": "log_only", "require_json": True},
    )
    _get_or_create_guardrail_policy(
        db,
        project=project,
        policy_type=POLICY_COST_BUDGET,
        config_json={"action": "log_only", "max_cost_usd": "0.050000"},
    )
    _get_or_create_guardrail_policy(
        db,
        project=project,
        policy_type=POLICY_LATENCY_RETRY,
        config_json={
            "action": "retry",
            "max_latency_ms": 1800,
            "fallback_model": "gpt-4.1-mini",
        },
    )
    _get_or_create_guardrail_policy(
        db,
        project=project,
        policy_type=POLICY_HALLUCINATION,
        config_json={"action": "log_only", "require_retrieval": True},
    )

    _get_or_create_seed_deployment(
        db,
        project=project,
        seed_key="stable-baseline",
        prompt_version_id=prompt_v23.id if prompt_v23 is not None else None,
        model_version_id=model_old.id,
        deployed_at=baseline_start,
        deployed_by="seed@reliai.local",
        metadata_json={
            "git_commit": "seed-baseline",
            "pipeline": "seed-script",
            "deployment_strategy": "full_rollout",
        },
    )
    _get_or_create_seed_deployment(
        db,
        project=project,
        seed_key="degraded-rollout",
        prompt_version_id=prompt_v24.id if prompt_v24 is not None else None,
        model_version_id=model_new.id,
        deployed_at=deployment_time,
        deployed_by="seed@reliai.local",
        metadata_json={
            "git_commit": "seed-regression",
            "pipeline": "seed-script",
            "deployment_strategy": "canary",
        },
    )

    for index in range(12):
        _create_trace_if_missing(
            db,
            project=project,
            payload=_build_trace_payload(
                timestamp=baseline_start + timedelta(minutes=index * 4),
                request_id=f"{SEED_REQUEST_PREFIX}-baseline-{index + 1}",
                model_name="gpt-4.1",
                model_provider="openai",
                model_version="2026-01",
                prompt_version="v23",
                input_text=f"Customer asks for refund policy example #{index + 1}",
                output_text='{"answer":"Refunds are available within 30 days.","confidence":"high"}',
                latency_ms=640 + (index * 18),
                prompt_tokens=620 + (index * 8),
                completion_tokens=180 + (index * 6),
                total_cost_usd=f"{Decimal('0.011500') + (Decimal(index) * Decimal('0.000400')):.6f}",
                success=True,
                error_type=None,
                retrieval_latency_ms=110 + (index * 7),
                source_count=4,
                top_k=4,
                metadata_json={"grounded": True},
            ),
        )

    for index in range(12):
        degraded = index < 8
        _create_trace_if_missing(
            db,
            project=project,
            payload=_build_trace_payload(
                timestamp=current_start + timedelta(minutes=index * 2),
                request_id=f"{SEED_REQUEST_PREFIX}-current-{index + 1}",
                model_name="gpt-4.1",
                model_provider="openai",
                model_version="2026-02",
                prompt_version="v24",
                input_text=f"Customer asks for billing cancellation guidance #{index + 1}",
                output_text=(
                    '{"answer":"Please cancel in the billing portal.","confidence":"medium"}'
                    if not degraded and index % 2 == 0
                    else '{"answer":"Contact support","confidence":"low"}'
                    if not degraded
                    else '{"answer":"Cancellation requires manager review"'
                ),
                latency_ms=1180 + (index * 110) if not degraded else 2480 + (index * 160),
                prompt_tokens=720 + (index * 10),
                completion_tokens=220 + (index * 10),
                total_cost_usd=(
                    f"{Decimal('0.031000') + (Decimal(index) * Decimal('0.001200')):.6f}"
                    if not degraded
                    else f"{Decimal('0.062000') + (Decimal(index) * Decimal('0.003000')):.6f}"
                ),
                success=not degraded,
                error_type=None if not degraded else "schema_validation_error",
                retrieval_latency_ms=320 + (index * 35) if not degraded else 760 + (index * 55),
                source_count=3 if not degraded else 1,
                top_k=4,
                metadata_json={
                    "grounded": not degraded,
                    "hallucination_detected": degraded,
                },
            ),
        )

    compute_project_reliability_metrics(db, project=project, anchor_time=now)
    db.commit()

    return {
        "baseline_traces": 12,
        "current_traces": 12,
        "guardrail_policies": 4,
        "deployments": 2,
    }


def _seed_stale_telemetry_scenario(db, *, project: Project) -> dict[str, str | int]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    deployment_time = now - timedelta(hours=5, minutes=30)
    rollback_time = deployment_time + timedelta(minutes=14)
    last_trace_time = now - timedelta(hours=3, minutes=20)

    prompt_v8 = ensure_prompt_version_record(db, project=project, version="v8")
    prompt_v9 = ensure_prompt_version_record(db, project=project, version="v9")
    model_stable = ensure_model_version_record(
        db,
        project=project,
        provider="openai",
        model_name="gpt-4.1-mini",
        model_version="2026-01",
        route_key="checkout-primary",
    )
    model_bad = ensure_model_version_record(
        db,
        project=project,
        provider="openai",
        model_name="gpt-4.1-mini",
        model_version="2026-02",
        route_key="checkout-primary",
    )
    db.commit()

    _get_or_create_seed_deployment(
        db,
        project=project,
        seed_key="checkout-stable",
        prompt_version_id=prompt_v8.id if prompt_v8 is not None else None,
        model_version_id=model_stable.id,
        deployed_at=deployment_time - timedelta(hours=1),
        deployed_by="seed@reliai.local",
        metadata_json={
            "git_commit": "seed-checkout-stable",
            "pipeline": "seed-script",
            "deployment_strategy": "full_rollout",
        },
    )
    degraded_deployment = _get_or_create_seed_deployment(
        db,
        project=project,
        seed_key="checkout-bad-rollout",
        prompt_version_id=prompt_v9.id if prompt_v9 is not None else None,
        model_version_id=model_bad.id,
        deployed_at=deployment_time,
        deployed_by="seed@reliai.local",
        metadata_json={
            "git_commit": "seed-checkout-bad",
            "pipeline": "seed-script",
            "deployment_strategy": "canary",
            "incident_hint": "rollback-test-scenario",
        },
    )
    _get_or_create_seed_rollback(
        db,
        deployment=degraded_deployment,
        rollback_reason="Latency regression detected during canary",
        rolled_back_at=rollback_time,
        metadata_json={
            "rolled_back_to_prompt_version": "v8",
            "rolled_back_to_model_version": "2026-01",
            "seed_scenario": "stale-telemetry-rollback",
        },
    )

    for index in range(4):
        _create_trace_if_missing(
            db,
            project=project,
            payload=_build_trace_payload(
                timestamp=last_trace_time - timedelta(minutes=18 - (index * 4)),
                request_id=f"sample-checkout-stale-{index + 1}",
                model_name="gpt-4.1-mini",
                model_provider="openai",
                model_version="2026-02" if index < 2 else "2026-01",
                prompt_version="v9" if index < 2 else "v8",
                input_text=f"Customer asks for order status recovery case #{index + 1}",
                output_text='{"answer":"Use the order timeline page.","confidence":"medium"}',
                latency_ms=890 + (index * 70),
                prompt_tokens=410 + (index * 12),
                completion_tokens=120 + (index * 7),
                total_cost_usd=f"{Decimal('0.008500') + (Decimal(index) * Decimal('0.000300')):.6f}",
                success=True,
                error_type=None,
                retrieval_latency_ms=180 + (index * 22),
                source_count=3,
                top_k=3,
                metadata_json={
                    "grounded": True,
                    "seed_scenario": "stale-telemetry-rollback",
                },
            ),
        )

    project.last_trace_received_at = last_trace_time
    db.add(project)
    compute_project_reliability_metrics(db, project=project, anchor_time=now)
    db.commit()
    run_reliability_sweep_for_session(db, anchor_time=now.isoformat())

    return {
        "last_trace_received_at": last_trace_time.isoformat(),
        "deployments": 2,
        "rollbacks": 1,
        "trace_count": 4,
    }


def run() -> None:
    db = SessionLocal()
    try:
        operator = db.scalar(select(OperatorUser).where(OperatorUser.email == SEED_OPERATOR_EMAIL))
        if operator is None:
            operator = create_operator_user(
                db,
                email=SEED_OPERATOR_EMAIL,
                password=SEED_OPERATOR_PASSWORD,
            )
            db.commit()
            db.refresh(operator)

        organization = db.scalar(select(Organization).where(Organization.slug == "acme"))
        if organization is None:
            organization = Organization(name="Acme AI", slug="acme", plan="pilot")
            db.add(organization)
            db.flush()
            db.add(
                OrganizationMember(
                    organization_id=organization.id,
                    user_id=operator.id,
                    auth_user_id=str(operator.id),
                    role="owner",
                )
            )
            get_or_create_checklist(db, organization.id)
            db.commit()
            db.refresh(organization)
        else:
            membership = db.scalar(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == organization.id,
                    OrganizationMember.user_id == operator.id,
                )
            )
            if membership is None:
                db.add(
                    OrganizationMember(
                        organization_id=organization.id,
                        user_id=operator.id,
                        auth_user_id=str(operator.id),
                        role="owner",
                    )
                )
                db.commit()

        project = _get_or_create_project(
            db,
            organization_id=organization.id,
            name="Support Agent",
            slug=slugify("Support Agent"),
            environment="prod",
            description="Seed project for local development",
        )
        stale_project = _get_or_create_project(
            db,
            organization_id=organization.id,
            name="Checkout Assistant",
            slug=STALE_PROJECT_SLUG,
            environment="prod",
            description="Seed project for stale telemetry and rollback testing",
        )

        sample_summary = _seed_sample_dataset(db, project=project)
        stale_summary = _seed_stale_telemetry_scenario(db, project=stale_project)

        key_record, plaintext = create_api_key(db, project.id, APIKeyCreate(label="Local ingest"))
        trace_total = len(db.scalars(select(Trace).where(Trace.project_id == project.id)).all())
        stale_trace_total = len(db.scalars(select(Trace).where(Trace.project_id == stale_project.id)).all())
        active_key_count = len(
            db.scalars(
                select(APIKey).where(APIKey.project_id == project.id, APIKey.revoked_at.is_(None))
            ).all()
        )
        print(f"Seeded operator_email={SEED_OPERATOR_EMAIL}")
        print(f"Seeded operator_password={SEED_OPERATOR_PASSWORD}")
        print(f"Seeded organization={organization.id}")
        print(f"Seeded project={project.id}")
        print(f"Seeded stale_test_project={stale_project.id}")
        print(f"API key={plaintext}")
        print(f"Generated at={datetime.now(timezone.utc).isoformat()}")
        print(f"Key record={key_record.id}")
        print(f"Sample traces_total={trace_total}")
        print(f"Sample baseline_traces={sample_summary['baseline_traces']}")
        print(f"Sample current_traces={sample_summary['current_traces']}")
        print(f"Sample deployments={sample_summary['deployments']}")
        print(f"Sample guardrail_policies={sample_summary['guardrail_policies']}")
        print(f"Stale scenario traces_total={stale_trace_total}")
        print(f"Stale scenario deployments={stale_summary['deployments']}")
        print(f"Stale scenario rollbacks={stale_summary['rollbacks']}")
        print(f"Stale scenario last_trace_received_at={stale_summary['last_trace_received_at']}")
        print(f"Active api_keys={active_key_count}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
