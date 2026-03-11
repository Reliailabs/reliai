from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.api_key import APIKey
from app.models.organization_guardrail_policy import OrganizationGuardrailPolicy
from app.models.project import Project
from app.services.event_log import list_event_log_entries
from app.services.trace_query_router import query_recent_traces
from app.services.trace_warehouse import TraceWarehouseQuery


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def list_active_organization_guardrail_policies(
    db: Session,
    *,
    organization_id: UUID,
) -> list[OrganizationGuardrailPolicy]:
    return list(
        db.scalars(
            select(OrganizationGuardrailPolicy)
            .where(
                OrganizationGuardrailPolicy.organization_id == organization_id,
                OrganizationGuardrailPolicy.enabled.is_(True),
            )
            .order_by(OrganizationGuardrailPolicy.created_at.asc(), OrganizationGuardrailPolicy.id.asc())
        ).all()
    )


def require_api_key_organization_access(
    db: Session,
    *,
    api_key: APIKey,
    organization_id: UUID,
) -> Project:
    project = db.get(Project, api_key.project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return project


def guardrail_compliance_for_project(
    db: Session,
    *,
    organization_id: UUID,
    project_id: UUID,
    environment_id: UUID | None = None,
    window_hours: int = 24,
) -> list[dict]:
    policies = list_active_organization_guardrail_policies(db, organization_id=organization_id)
    if not policies:
        return []

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=window_hours)
    rows = query_recent_traces(
        TraceWarehouseQuery(
            organization_id=organization_id,
            project_id=project_id,
            environment_id=environment_id,
            window_start=window_start,
            window_end=now,
            limit=5000,
        )
    )
    violations = list_event_log_entries(
        db,
        event_types=["policy_violation"],
        project_id=project_id,
        limit=5000,
    )
    violation_counts: dict[str, int] = {}
    for item in violations:
        if _as_utc(item.timestamp) < window_start:
            continue
        policy_type = str(item.payload_json.get("policy_type") or "")
        if policy_type:
            violation_counts[policy_type] = violation_counts.get(policy_type, 0) + 1

    compliance: list[dict] = []
    for policy in policies:
        coverage_pct = _policy_coverage(policy, rows)
        compliance.append(
            {
                "policy_type": policy.policy_type,
                "enforcement_mode": policy.enforcement_mode,
                "coverage_pct": coverage_pct,
                "violation_count": violation_counts.get(policy.policy_type, 0),
            }
        )
    return compliance


def _policy_coverage(policy: OrganizationGuardrailPolicy, rows: Iterable[object]) -> float:
    total = 0
    compliant = 0
    config = policy.config_json or {}
    for row in rows:
        if policy.policy_type == "structured_output":
            value = getattr(row, "structured_output_valid", None)
            if value is None:
                continue
            total += 1
            if bool(value):
                compliant += 1
        elif policy.policy_type == "cost_budget":
            cost = getattr(row, "cost", None)
            if cost is None or config.get("max_cost_usd") is None:
                continue
            total += 1
            if float(cost) <= float(config["max_cost_usd"]):
                compliant += 1
        elif policy.policy_type in {"latency_retry", "latency_retry_sdk"}:
            latency = getattr(row, "latency_ms", None)
            if latency is None or config.get("max_latency_ms") is None:
                continue
            total += 1
            if int(latency) <= int(config["max_latency_ms"]):
                compliant += 1
        else:
            continue
    if total == 0:
        return 100.0
    return round((compliant / total) * 100, 1)
