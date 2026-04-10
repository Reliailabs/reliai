from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.limits import LimitCTA, LimitScope, LimitStatus
from app.services.auth import OperatorContext
from app.services.environments import get_default_environment
from app.services.rate_limiter import get_limit_exceeded_count, get_limit_exceeded_timestamp
from app.services.trace_ingestion_control import get_effective_ingestion_policy
from app.services.usage_quotas import get_usage_status

SEVERITY_ORDER = {"critical": 3, "warning": 2, "info": 1}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sort_limits(limits: list[LimitStatus]) -> list[LimitStatus]:
    return sorted(limits, key=lambda item: SEVERITY_ORDER.get(item.severity, 0), reverse=True)


def _ingestion_policy_href(project: Project | None) -> str:
    if project is None:
        return "/projects"
    return f"/projects/{project.id}/ingestion"


def _storage_limit(db: Session, *, organization_id: UUID) -> LimitStatus | None:
    usage = get_usage_status(db, organization_id=organization_id)
    percent_used = float(usage.get("percent_used") or 0)
    projected_usage = usage.get("projected_usage")
    limit = usage.get("limit")
    used = usage.get("used")
    if not limit:
        return None

    if percent_used >= 1.0:
        return LimitStatus(
            type="storage",
            status="limited",
            severity="critical",
            message="Storage limit reached — older traces may be removed.",
            scope=LimitScope(level="global"),
            metrics={
                "quota_used_pct": round(percent_used, 3),
                "used": int(used) if used is not None else None,
                "limit": int(limit) if limit is not None else None,
            },
            window="1h",
            actionable={"primary": "Free up space or increase retention now."},
            is_plan_related=True,
            cta_priority="settings_first",
            cta=LimitCTA(
                label="View retention settings",
                href="/settings/billing",
                type="settings",
            ),
            cta_secondary=LimitCTA(
                label="Increase retention",
                href="/settings/billing",
                type="upgrade",
            ),
            updated_at=_now(),
        )

    if projected_usage and projected_usage > int(limit):
        return LimitStatus(
            type="storage",
            status="warning",
            severity="warning",
            message="Storage nearing limit — retention may be constrained soon.",
            scope=LimitScope(level="global"),
            metrics={
                "quota_used_pct": round(percent_used, 3),
                "used": int(used) if used is not None else None,
                "limit": int(limit) if limit is not None else None,
            },
            window="1h",
            actionable={"primary": "Stored trace volume is approaching your retention limit."},
            is_plan_related=True,
            cta_priority="settings_first",
            cta=LimitCTA(
                label="View retention settings",
                href="/settings/billing",
                type="settings",
            ),
            cta_secondary=LimitCTA(
                label="Increase retention",
                href="/settings/billing",
                type="upgrade",
            ),
            updated_at=_now(),
        )

    return None


def _sampling_limit(db: Session, *, project: Project) -> LimitStatus | None:
    environment = get_default_environment(db, project_id=project.id)
    policy = get_effective_ingestion_policy(db, project_id=project.id, environment_id=environment.id)
    if policy.sampling_success_rate >= 1.0 and policy.sampling_error_rate >= 1.0:
        return None
    return LimitStatus(
        type="sampling",
        status="warning",
        severity="warning",
        message="Sampling active — some traces are not stored. Evidence may be partial.",
        scope=LimitScope(level="project", project_id=str(project.id)),
        window="15m",
        is_plan_related=False,
        cta_priority="settings_first",
        cta=LimitCTA(
            label="View ingestion policy",
            href=f"/projects/{project.id}/ingestion",
            type="settings",
        ),
        cta_secondary=LimitCTA(
            label="Reduce ingest rate (sampling)",
            href=f"/projects/{project.id}/ingestion",
            type="settings",
        ),
        updated_at=_now(),
    )


def _limit_from_flag(
    *,
    limit_type: str,
    identifier: str,
    severity: str,
    status: str,
    message: str,
    scope: LimitScope,
    window: str,
    is_plan_related: bool,
    cta_priority: str,
    actionable: dict | None = None,
    cta: LimitCTA | None = None,
    cta_secondary: LimitCTA | None = None,
) -> LimitStatus | None:
    timestamp = get_limit_exceeded_timestamp(scope=limit_type, identifier=identifier)
    if timestamp is None:
        return None
    return LimitStatus(
        type=limit_type,
        status=status,
        severity=severity,
        message=message,
        scope=scope,
        window=window,
        actionable=actionable,
        is_plan_related=is_plan_related,
        cta_priority=cta_priority,
        cta=cta,
        cta_secondary=cta_secondary,
        updated_at=timestamp,
    )


def get_limit_statuses(
    db: Session,
    *,
    operator: OperatorContext,
    project: Project | None = None,
) -> list[LimitStatus]:
    organization_id = operator.active_organization_id
    if organization_id is None:
        return []

    limits: list[LimitStatus] = []

    ingest_global = _limit_from_flag(
        limit_type="ingest_global",
        identifier="global",
        severity="critical",
        status="limited",
        message="Trace ingestion rate limited — new traces are being dropped.",
        scope=LimitScope(level="global"),
        window="1m",
        is_plan_related=True,
        cta_priority="settings_first",
        actionable={"primary": "High trace volume exceeded your ingest rate."},
        cta=LimitCTA(
            label="Reduce ingest rate (sampling)",
            href=_ingestion_policy_href(project),
            type="settings",
        ),
        cta_secondary=LimitCTA(
            label="Upgrade ingest capacity",
            href="/settings/billing",
            type="upgrade",
        ),
    )
    if ingest_global:
        count = get_limit_exceeded_count(scope="ingest_global", identifier="global")
        if count:
            ingest_global.metrics = {**(ingest_global.metrics or {}), "dropped": count}
        limits.append(ingest_global)

    if project is not None:
        ingest_project = _limit_from_flag(
            limit_type="ingest_project",
            identifier=str(project.id),
            severity="critical",
            status="limited",
            message="Project ingest limit reached — this project is dropping traces.",
            scope=LimitScope(level="project", project_id=str(project.id)),
            window="1m",
            is_plan_related=True,
            cta_priority="settings_first",
            actionable={"primary": "High trace volume exceeded your ingest rate."},
            cta=LimitCTA(
                label="Reduce ingest rate (sampling)",
                href=f"/projects/{project.id}/ingestion",
                type="settings",
            ),
            cta_secondary=LimitCTA(
                label="Upgrade ingest capacity",
                href="/settings/billing",
                type="upgrade",
            ),
        )
        if ingest_project:
            count = get_limit_exceeded_count(scope="ingest_project", identifier=str(project.id))
            if count:
                ingest_project.metrics = {**(ingest_project.metrics or {}), "dropped": count}
            limits.append(ingest_project)

    api_rate = _limit_from_flag(
        limit_type="api_rate",
        identifier=str(organization_id),
        severity="warning",
        status="limited",
        message="API rate limit reached — some actions may be delayed.",
        scope=LimitScope(level="global"),
        window="1m",
        is_plan_related=False,
        cta_priority="settings_first",
        cta=LimitCTA(
            label="View usage",
            href="/settings/billing",
            type="settings",
        ),
    )
    if api_rate:
        count = get_limit_exceeded_count(scope="api_rate", identifier=str(organization_id))
        if count:
            api_rate.metrics = {**(api_rate.metrics or {}), "blocked": count}
        limits.append(api_rate)

    if project is not None:
        processor_limit = _limit_from_flag(
            limit_type="processor_dispatch",
            identifier=str(project.id),
            severity="warning",
            status="delayed",
            message="Processing delayed — analysis is queued.",
            scope=LimitScope(level="project", project_id=str(project.id)),
            window="1m",
            is_plan_related=False,
            cta_priority="none",
            cta=None,
        )
        if processor_limit:
            limits.append(processor_limit)

    llm_features = [
        ("ai_summary", "Provider limit hit — try again shortly."),
        ("ai_root_cause", "Provider limit hit — try again shortly."),
        ("ai_ticket_draft", "Provider limit hit — try again shortly."),
        ("ai_fix_summary", "Provider limit hit — try again shortly."),
    ]
    for feature, message in llm_features:
        llm_limit = _limit_from_flag(
            limit_type="llm_provider",
            identifier=feature,
            severity="warning",
            status="limited",
            message=message,
            scope=LimitScope(level="ai_feature", feature=feature),
            window="15m",
            is_plan_related=False,
            cta_priority="none",
            cta=None,
        )
        if llm_limit:
            limits.append(llm_limit)

    storage_limit = _storage_limit(db, organization_id=organization_id)
    if storage_limit:
        limits.append(storage_limit)

    if project is not None:
        sampling_limit = _sampling_limit(db, project=project)
        if sampling_limit:
            limits.append(sampling_limit)

    return _sort_limits(limits)
