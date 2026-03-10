from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_operator
from app.db.session import get_db
from app.schemas.api_key import APIKeyCreate, APIKeyCreateResponse, APIKeyRead
from app.schemas.alert_delivery import AlertDeliveryListResponse, AlertDeliveryRead
from app.schemas.auth import AuthSessionResponse, AuthSignInRequest, OperatorMembershipRead, OperatorRead
from app.schemas.incident import (
    IncidentCompareRead,
    IncidentDetailRead,
    IncidentListItemRead,
    IncidentListQuery,
    IncidentListResponse,
    IncidentOwnerAssignRequest,
    IncidentRuleContextRead,
    IncidentTraceSampleRead,
)
from app.schemas.investigation import (
    CohortPivotRead,
    DimensionSummaryRead,
    ModelVersionContextRead,
    PromptVersionContextRead,
    RootCauseHintRead,
    TraceDiffBlockRead,
)
from app.schemas.incident_event import IncidentEventListResponse, IncidentEventRead
from app.schemas.organization import OrganizationCreate, OrganizationRead
from app.schemas.organization_alert_target import (
    OrganizationAlertTargetRead,
    OrganizationAlertTargetTestResponse,
    OrganizationAlertTargetUpsertRequest,
)
from app.schemas.project import (
    ModelVersionDetailRead,
    ModelVersionListResponse,
    ModelVersionRead,
    ProjectCreate,
    ProjectListQuery,
    ProjectListResponse,
    ProjectRead,
    PromptVersionDetailRead,
    PromptVersionListResponse,
    PromptVersionRead,
    VersionIncidentRead,
    VersionRegressionRead,
    VersionTraceRead,
)
from app.schemas.reliability import (
    ProjectReliabilityRead,
    ReliabilityMetricPointRead,
    ReliabilityMetricSeriesRead,
    ReliabilityRecentIncidentRead,
)
from app.schemas.regression import (
    RegressionDetailRead,
    RegressionListQuery,
    RegressionListResponse,
    RegressionRelatedIncidentRead,
    RegressionSnapshotRead,
)
from app.schemas.trace import (
    TraceCompareItemRead,
    TraceComparePairRead,
    TraceComparisonRead,
    TraceAcceptedResponse,
    TraceDetailRead,
    TraceIngestRequest,
    TraceListQuery,
    TraceListResponse,
)
from app.services.api_keys import authenticate_api_key, create_api_key
from app.services.auth import (
    OperatorContext,
    get_operator_memberships,
    revoke_session,
    sign_in_operator,
)
from app.services.incidents import (
    acknowledge_incident,
    assign_incident_owner,
    build_cohort_pivots,
    build_trace_compare_item,
    build_trace_diff_blocks,
    derive_dimension_summaries,
    derive_registry_contexts,
    derive_root_cause_hints,
    get_incident_alert_deliveries,
    get_incident_compare_traces,
    get_incident_detail,
    get_incident_events,
    get_incident_regressions,
    get_incident_rule,
    get_incident_traces,
    list_incidents,
    reopen_incident,
    resolve_incident,
)
from app.services.regressions import get_regression_compare, get_regression_detail, list_project_regressions
from app.services.authorization import require_organization_membership, require_project_access
from app.services.organizations import create_organization, get_organization
from app.services.organization_alert_targets import (
    get_org_alert_target,
    org_alert_target_read_model,
    set_org_alert_target_enabled,
    test_org_alert_target,
    upsert_org_alert_target,
)
from app.services.projects import create_project, list_projects
from app.services.prompt_versions import get_prompt_version_detail
from app.services.reliability_metrics import (
    METRIC_ALERT_DELIVERY_SUCCESS_RATE,
    METRIC_DETECTION_COVERAGE,
    METRIC_EXPLAINABILITY_SCORE,
    METRIC_FALSE_POSITIVE_RATE,
    METRIC_INCIDENT_DENSITY,
    METRIC_INCIDENT_DETECTION_LATENCY_P90,
    METRIC_MTTA_P90,
    METRIC_MTTR_P90,
    METRIC_QUALITY_PASS_RATE,
    METRIC_ROOT_CAUSE_LOCALIZATION_SCORE,
    METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE,
    METRIC_TELEMETRY_FRESHNESS_MINUTES,
    compute_reliability_score,
    latest_project_reliability_metrics,
    project_reliability_trends,
)
from app.services.registry import (
    build_model_version_path,
    build_prompt_version_path,
    list_project_model_versions,
    list_project_prompt_versions,
)
from app.services.model_versions import get_model_version_detail
from app.services.traces import get_trace_compare, get_trace_detail, ingest_trace, list_traces

router = APIRouter()


def _read_datetime(value):
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


def _incident_list_item(incident) -> IncidentListItemRead:
    return IncidentListItemRead(
        id=incident.id,
        organization_id=incident.organization_id,
        project_id=incident.project_id,
        project_name=incident.project.name,
        incident_type=incident.incident_type,
        severity=incident.severity,
        title=incident.title,
        status=incident.status,
        fingerprint=incident.fingerprint,
        summary_json=incident.summary_json,
        started_at=incident.started_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
        acknowledged_at=incident.acknowledged_at,
        acknowledged_by_operator_user_id=incident.acknowledged_by_operator_user_id,
        acknowledged_by_operator_email=incident.acknowledged_by_operator.email
        if incident.acknowledged_by_operator is not None
        else None,
        owner_operator_user_id=incident.owner_operator_user_id,
        owner_operator_email=incident.owner_operator.email if incident.owner_operator is not None else None,
        latest_alert_delivery=AlertDeliveryRead.model_validate(incident.latest_alert_delivery)
        if getattr(incident, "latest_alert_delivery", None) is not None
        else None,
    )


def _incident_event_item(event) -> IncidentEventRead:
    return IncidentEventRead(
        id=event.id,
        incident_id=event.incident_id,
        event_type=event.event_type,
        actor_operator_user_id=event.actor_operator_user_id,
        actor_operator_user_email=event.actor_operator_user.email
        if event.actor_operator_user is not None
        else None,
        metadata_json=event.metadata_json,
        created_at=event.created_at,
    )


def _root_cause_hint_item(hint: dict) -> RootCauseHintRead:
    return RootCauseHintRead.model_validate(hint)


def _dimension_summary_item(summary: dict) -> DimensionSummaryRead:
    return DimensionSummaryRead.model_validate(summary)


def _cohort_pivot_item(pivot: dict) -> CohortPivotRead:
    return CohortPivotRead.model_validate(pivot)


def _trace_diff_block_item(block: dict) -> TraceDiffBlockRead:
    return TraceDiffBlockRead.model_validate(block)


def _prompt_version_context_item(item: dict) -> PromptVersionContextRead:
    return PromptVersionContextRead.model_validate(item)


def _model_version_context_item(item: dict) -> ModelVersionContextRead:
    return ModelVersionContextRead.model_validate(item)


def _trace_compare_item(trace) -> TraceCompareItemRead:
    return TraceCompareItemRead.model_validate(build_trace_compare_item(trace))


def _version_trace_item(trace) -> VersionTraceRead:
    return VersionTraceRead(
        id=trace.id,
        request_id=trace.request_id,
        timestamp=trace.timestamp,
        model_name=trace.model_name,
        prompt_version=trace.prompt_version,
        latency_ms=trace.latency_ms,
        success=trace.success,
        error_type=trace.error_type,
        created_at=trace.created_at,
    )


def _version_regression_item(regression) -> VersionRegressionRead:
    return VersionRegressionRead(
        id=regression.id,
        metric_name=regression.metric_name,
        scope_type=regression.scope_type,
        scope_id=regression.scope_id,
        current_value=float(regression.current_value),
        baseline_value=float(regression.baseline_value),
        delta_percent=float(regression.delta_percent) if regression.delta_percent is not None else None,
        detected_at=regression.detected_at,
    )


def _version_incident_item(incident) -> VersionIncidentRead:
    return VersionIncidentRead(
        id=incident.id,
        incident_type=incident.incident_type,
        severity=incident.severity,
        status=incident.status,
        title=incident.title,
        started_at=incident.started_at,
        updated_at=incident.updated_at,
    )


def _trace_detail_item(trace, registry_pivots, compare_path: str | None) -> TraceDetailRead:
    return TraceDetailRead(
        id=trace.id,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        environment=trace.environment,
        timestamp=trace.timestamp,
        request_id=trace.request_id,
        user_id=trace.user_id,
        session_id=trace.session_id,
        model_name=trace.model_name,
        model_provider=trace.model_provider,
        prompt_version=trace.prompt_version,
        input_text=trace.input_text,
        output_text=trace.output_text,
        input_preview=trace.input_preview,
        output_preview=trace.output_preview,
        latency_ms=trace.latency_ms,
        prompt_tokens=trace.prompt_tokens,
        completion_tokens=trace.completion_tokens,
        total_cost_usd=trace.total_cost_usd,
        success=trace.success,
        error_type=trace.error_type,
        metadata_json=trace.metadata_json,
        created_at=trace.created_at,
        prompt_version_record=PromptVersionRead.model_validate(trace.prompt_version_record)
        if trace.prompt_version_record is not None
        else None,
        model_version_record=ModelVersionRead.model_validate(trace.model_version_record)
        if trace.model_version_record is not None
        else None,
        registry_pivots=registry_pivots,
        compare_path=compare_path,
        retrieval_span=trace.retrieval_span,
        evaluations=trace.evaluations,
    )


def _trace_comparison_item(
    *,
    comparison_scope: str,
    source_id,
    incident_id,
    regression_id,
    project_id,
    metric_name,
    scope_type,
    scope_id,
    current_window_start,
    current_window_end,
    baseline_window_start,
    baseline_window_end,
    current_traces,
    baseline_traces,
    dimension_summaries,
    prompt_version_contexts,
    model_version_contexts,
    cohort_pivots,
    related_incident_id,
) -> TraceComparisonRead:
    current_items = [_trace_compare_item(trace) for trace in current_traces]
    baseline_items = [_trace_compare_item(trace) for trace in baseline_traces]
    pair_count = max(len(current_items), len(baseline_items))
    pairs = [
        TraceComparePairRead(
            pair_index=index,
            current_trace=current_items[index] if index < len(current_items) else None,
            baseline_trace=baseline_items[index] if index < len(baseline_items) else None,
            diff_blocks=[
                _trace_diff_block_item(block)
                for block in build_trace_diff_blocks(
                    current_traces[index] if index < len(current_traces) else None,
                    baseline_traces[index] if index < len(baseline_traces) else None,
                )
            ],
        )
        for index in range(pair_count)
    ]
    return TraceComparisonRead(
        comparison_scope=comparison_scope,
        source_id=source_id,
        incident_id=incident_id,
        regression_id=regression_id,
        project_id=project_id,
        metric_name=metric_name,
        scope_type=scope_type,
        scope_id=scope_id,
        current_window_start=current_window_start,
        current_window_end=current_window_end,
        baseline_window_start=baseline_window_start,
        baseline_window_end=baseline_window_end,
        current_traces=current_items,
        baseline_traces=baseline_items,
        pairs=pairs,
        dimension_summaries=[_dimension_summary_item(summary) for summary in dimension_summaries],
        prompt_version_contexts=[
            _prompt_version_context_item(item) for item in prompt_version_contexts
        ],
        model_version_contexts=[_model_version_context_item(item) for item in model_version_contexts],
        cohort_pivots=[_cohort_pivot_item(pivot) for pivot in cohort_pivots],
        related_incident_id=related_incident_id,
    )


def _reliability_metric_point_item(metric) -> ReliabilityMetricPointRead:
    return ReliabilityMetricPointRead.model_validate(metric)


def _reliability_series_item(metric_name: str, metrics) -> ReliabilityMetricSeriesRead:
    return ReliabilityMetricSeriesRead(
        metric_name=metric_name,
        unit=metrics[0].unit if metrics else "ratio",
        points=[_reliability_metric_point_item(metric) for metric in metrics],
    )


def _incident_compare_item(incident, regressions, representative_traces, baseline_traces) -> IncidentCompareRead:
    summary = incident.summary_json or {}
    rule = get_incident_rule(incident.incident_type)
    root_cause_hints = derive_root_cause_hints(
        incident=incident,
        current_traces=representative_traces,
        baseline_traces=baseline_traces,
    )
    dimension_summaries = derive_dimension_summaries(
        current_traces=representative_traces,
        baseline_traces=baseline_traces,
    )
    prompt_version_contexts, model_version_contexts = derive_registry_contexts(
        project_id=incident.project_id,
        current_traces=representative_traces,
        baseline_traces=baseline_traces,
    )
    cohort_pivots = build_cohort_pivots(
        project_id=incident.project_id,
        scope_type=summary.get("scope_type"),
        scope_id=summary.get("scope_id"),
        current_window_start=_read_datetime(summary.get("current_window_start")),
        current_window_end=_read_datetime(summary.get("current_window_end")),
        anchor_time=incident.started_at,
        current_traces=representative_traces,
    )
    return IncidentCompareRead(
        current_window_start=summary.get("current_window_start"),
        current_window_end=summary.get("current_window_end"),
        baseline_window_start=summary.get("baseline_window_start"),
        baseline_window_end=summary.get("baseline_window_end"),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        representative_traces=[
            IncidentTraceSampleRead.model_validate(trace) for trace in representative_traces
        ],
        current_representative_traces=[_trace_compare_item(trace) for trace in representative_traces],
        baseline_representative_traces=[_trace_compare_item(trace) for trace in baseline_traces],
        root_cause_hints=[_root_cause_hint_item(hint) for hint in root_cause_hints],
        dimension_summaries=[_dimension_summary_item(summary) for summary in dimension_summaries],
        prompt_version_contexts=[
            _prompt_version_context_item(item) for item in prompt_version_contexts
        ],
        model_version_contexts=[_model_version_context_item(item) for item in model_version_contexts],
        cohort_pivots=[_cohort_pivot_item(pivot) for pivot in cohort_pivots],
        rule_context=IncidentRuleContextRead(
            incident_type=rule.incident_type,
            metric_name=rule.metric_name,
            comparator=rule.comparator,
            absolute_threshold=rule.absolute_threshold,
            percent_threshold=rule.percent_threshold,
            minimum_sample_size=rule.minimum_sample_size,
        )
        if rule is not None
        else None,
        trace_compare_path=f"/incidents/{incident.id}/compare",
    )


@router.get("/health")
def versioned_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization_endpoint(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationRead:
    if payload.owner_auth_user_id != str(operator.operator.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return create_organization(db, payload)


@router.post("/auth/sign-in", response_model=AuthSessionResponse)
def sign_in_operator_endpoint(
    payload: AuthSignInRequest, db: Session = Depends(get_db)
) -> AuthSessionResponse:
    operator, session, session_token = sign_in_operator(db, payload)
    return AuthSessionResponse(
        session_token=session_token,
        operator=OperatorRead(id=operator.id, email=operator.email),
        memberships=[
            OperatorMembershipRead(organization_id=membership.organization_id, role=membership.role)
            for membership in get_operator_memberships(db, operator.id)
        ],
        expires_at=session.expires_at,
    )


@router.get("/auth/session", response_model=AuthSessionResponse)
def auth_session_endpoint(
    operator: OperatorContext = Depends(require_operator),
) -> AuthSessionResponse:
    return AuthSessionResponse(
        operator=OperatorRead(id=operator.operator.id, email=operator.operator.email),
        memberships=[
            OperatorMembershipRead(organization_id=membership.organization_id, role=membership.role)
            for membership in operator.memberships
        ],
        expires_at=operator.session.expires_at,
    )


@router.post("/auth/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out_operator_endpoint(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    revoke_session(db, authorization[7:])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/organizations/{organization_id}", response_model=OrganizationRead)
def get_organization_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationRead:
    require_organization_membership(operator, organization_id)
    return get_organization(db, organization_id)


@router.get(
    "/organizations/{organization_id}/alert-target",
    response_model=OrganizationAlertTargetRead,
)
def get_org_alert_target_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationAlertTargetRead:
    require_organization_membership(operator, organization_id)
    target = get_org_alert_target(db, organization_id)
    return OrganizationAlertTargetRead(**org_alert_target_read_model(target))


@router.put(
    "/organizations/{organization_id}/alert-target",
    response_model=OrganizationAlertTargetRead,
)
def upsert_org_alert_target_endpoint(
    organization_id: UUID,
    payload: OrganizationAlertTargetUpsertRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationAlertTargetRead:
    require_organization_membership(operator, organization_id)
    target = upsert_org_alert_target(db, organization_id=organization_id, payload=payload)
    return OrganizationAlertTargetRead(**org_alert_target_read_model(target))


@router.post(
    "/organizations/{organization_id}/alert-target/enable",
    response_model=OrganizationAlertTargetRead,
)
def enable_org_alert_target_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationAlertTargetRead:
    require_organization_membership(operator, organization_id)
    target = set_org_alert_target_enabled(db, organization_id=organization_id, enabled=True)
    return OrganizationAlertTargetRead(**org_alert_target_read_model(target))


@router.post(
    "/organizations/{organization_id}/alert-target/disable",
    response_model=OrganizationAlertTargetRead,
)
def disable_org_alert_target_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationAlertTargetRead:
    require_organization_membership(operator, organization_id)
    target = set_org_alert_target_enabled(db, organization_id=organization_id, enabled=False)
    return OrganizationAlertTargetRead(**org_alert_target_read_model(target))


@router.post(
    "/organizations/{organization_id}/alert-target/test",
    response_model=OrganizationAlertTargetTestResponse,
)
def test_org_alert_target_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationAlertTargetTestResponse:
    require_organization_membership(operator, organization_id)
    success, detail = test_org_alert_target(db, organization_id)
    return OrganizationAlertTargetTestResponse(
        success=success,
        detail=detail,
        tested_at=datetime.now(timezone.utc),
    )


@router.post(
    "/organizations/{organization_id}/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_endpoint(
    organization_id: UUID,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectRead:
    require_organization_membership(operator, organization_id)
    return create_project(db, organization_id, payload)


@router.get("/projects", response_model=ProjectListResponse)
def list_projects_endpoint(
    query: ProjectListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectListResponse:
    projects = list_projects(db, operator, query)
    return ProjectListResponse(items=[ProjectRead.model_validate(project) for project in projects])


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectRead:
    return require_project_access(db, operator, project_id)


@router.get("/projects/{project_id}/reliability", response_model=ProjectReliabilityRead)
def get_project_reliability_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectReliabilityRead:
    project = require_project_access(db, operator, project_id)
    latest = latest_project_reliability_metrics(db, project_id=project_id)
    metric_values = {
        "detection_latency_p90": latest.get(METRIC_INCIDENT_DETECTION_LATENCY_P90).value_number
        if latest.get(METRIC_INCIDENT_DETECTION_LATENCY_P90)
        else None,
        "MTTA_p90": latest.get(METRIC_MTTA_P90).value_number if latest.get(METRIC_MTTA_P90) else None,
        "MTTR_p90": latest.get(METRIC_MTTR_P90).value_number if latest.get(METRIC_MTTR_P90) else None,
        "false_positive_rate": latest.get(METRIC_FALSE_POSITIVE_RATE).value_number
        if latest.get(METRIC_FALSE_POSITIVE_RATE)
        else None,
        "detection_coverage": latest.get(METRIC_DETECTION_COVERAGE).value_number
        if latest.get(METRIC_DETECTION_COVERAGE)
        else None,
        "alert_delivery_success_rate": latest.get(METRIC_ALERT_DELIVERY_SUCCESS_RATE).value_number
        if latest.get(METRIC_ALERT_DELIVERY_SUCCESS_RATE)
        else None,
        "explainability_score": latest.get(METRIC_EXPLAINABILITY_SCORE).value_number
        if latest.get(METRIC_EXPLAINABILITY_SCORE)
        else None,
        "incident_density": latest.get(METRIC_INCIDENT_DENSITY).value_number
        if latest.get(METRIC_INCIDENT_DENSITY)
        else None,
    }
    recent_incidents = list_incidents(
        db,
        operator,
        IncidentListQuery(project_id=project_id, limit=5),
    )
    trend_rows = project_reliability_trends(
        db,
        project_id=project_id,
        metric_names=[
            METRIC_INCIDENT_DETECTION_LATENCY_P90,
            METRIC_MTTA_P90,
            METRIC_MTTR_P90,
            METRIC_FALSE_POSITIVE_RATE,
            METRIC_DETECTION_COVERAGE,
            METRIC_ALERT_DELIVERY_SUCCESS_RATE,
            METRIC_EXPLAINABILITY_SCORE,
            METRIC_INCIDENT_DENSITY,
        ],
    )
    return ProjectReliabilityRead(
        project_id=project.id,
        organization_id=project.organization_id,
        reliability_score=compute_reliability_score(metric_values),
        detection_latency_p90=metric_values["detection_latency_p90"],
        MTTA_p90=metric_values["MTTA_p90"],
        MTTR_p90=metric_values["MTTR_p90"],
        false_positive_rate=metric_values["false_positive_rate"],
        detection_coverage=metric_values["detection_coverage"],
        alert_delivery_success_rate=metric_values["alert_delivery_success_rate"],
        explainability_score=metric_values["explainability_score"],
        incident_density=metric_values["incident_density"],
        telemetry_freshness_minutes=latest.get(METRIC_TELEMETRY_FRESHNESS_MINUTES).value_number
        if latest.get(METRIC_TELEMETRY_FRESHNESS_MINUTES)
        else None,
        quality_pass_rate=latest.get(METRIC_QUALITY_PASS_RATE).value_number
        if latest.get(METRIC_QUALITY_PASS_RATE)
        else None,
        structured_output_validity_rate=latest.get(METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE).value_number
        if latest.get(METRIC_STRUCTURED_OUTPUT_VALIDITY_RATE)
        else None,
        root_cause_localization_score=latest.get(METRIC_ROOT_CAUSE_LOCALIZATION_SCORE).value_number
        if latest.get(METRIC_ROOT_CAUSE_LOCALIZATION_SCORE)
        else None,
        recent_incidents=[
            ReliabilityRecentIncidentRead(
                id=incident.id,
                incident_type=incident.incident_type,
                severity=incident.severity,
                status=incident.status,
                title=incident.title,
                started_at=incident.started_at,
                updated_at=incident.updated_at,
            )
            for incident in recent_incidents
        ],
        trend_series=[
            _reliability_series_item(metric_name, metrics)
            for metric_name, metrics in trend_rows.items()
        ],
    )


@router.get("/projects/{project_id}/prompt-versions", response_model=PromptVersionListResponse)
def list_project_prompt_versions_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PromptVersionListResponse:
    require_project_access(db, operator, project_id)
    items = list_project_prompt_versions(db, project_id=project_id)
    return PromptVersionListResponse(items=[PromptVersionRead.model_validate(item) for item in items])


@router.get("/projects/{project_id}/prompt-versions/{prompt_version_id}", response_model=PromptVersionDetailRead)
def get_prompt_version_detail_endpoint(
    project_id: UUID,
    prompt_version_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PromptVersionDetailRead:
    require_project_access(db, operator, project_id)
    detail = get_prompt_version_detail(db, project_id=project_id, prompt_version_id=prompt_version_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt version not found")
    return PromptVersionDetailRead(
        prompt_version=PromptVersionRead.model_validate(detail["record"]),
        usage_summary={
            "trace_count": detail["trace_count"],
            "recent_trace_count": len(detail["recent_traces"]),
            "incident_count": len(detail["related_incidents"]),
            "regression_count": len(detail["recent_regressions"]),
        },
        recent_traces=[_version_trace_item(trace) for trace in detail["recent_traces"]],
        recent_regressions=[
            _version_regression_item(regression) for regression in detail["recent_regressions"]
        ],
        related_incidents=[
            _version_incident_item(incident) for incident in detail["related_incidents"]
        ],
        recent_reliability_metrics=[
            _reliability_metric_point_item(metric) for metric in detail["recent_reliability_metrics"]
        ],
        traces_path=detail["traces_path"],
        regressions_path=detail["regressions_path"],
        incidents_path=detail["incidents_path"],
    )


@router.get("/projects/{project_id}/model-versions", response_model=ModelVersionListResponse)
def list_project_model_versions_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ModelVersionListResponse:
    require_project_access(db, operator, project_id)
    items = list_project_model_versions(db, project_id=project_id)
    return ModelVersionListResponse(items=[ModelVersionRead.model_validate(item) for item in items])


@router.get("/projects/{project_id}/model-versions/{model_version_id}", response_model=ModelVersionDetailRead)
def get_model_version_detail_endpoint(
    project_id: UUID,
    model_version_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ModelVersionDetailRead:
    require_project_access(db, operator, project_id)
    detail = get_model_version_detail(db, project_id=project_id, model_version_id=model_version_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model version not found")
    return ModelVersionDetailRead(
        model_version=ModelVersionRead.model_validate(detail["record"]),
        usage_summary={
            "trace_count": detail["trace_count"],
            "recent_trace_count": len(detail["recent_traces"]),
            "incident_count": len(detail["related_incidents"]),
            "regression_count": len(detail["recent_regressions"]),
        },
        recent_traces=[_version_trace_item(trace) for trace in detail["recent_traces"]],
        recent_regressions=[
            _version_regression_item(regression) for regression in detail["recent_regressions"]
        ],
        related_incidents=[
            _version_incident_item(incident) for incident in detail["related_incidents"]
        ],
        recent_reliability_metrics=[
            _reliability_metric_point_item(metric) for metric in detail["recent_reliability_metrics"]
        ],
        traces_path=detail["traces_path"],
        regressions_path=detail["regressions_path"],
        incidents_path=detail["incidents_path"],
    )


@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents_endpoint(
    query: IncidentListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentListResponse:
    incidents = list_incidents(db, operator, query)
    return IncidentListResponse(items=[_incident_list_item(incident) for incident in incidents])


@router.get("/incidents/{incident_id}", response_model=IncidentDetailRead)
def get_incident_detail_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = get_incident_detail(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(incident, regressions, representative_traces, baseline_traces),
    )


@router.post("/incidents/{incident_id}/acknowledge", response_model=IncidentDetailRead)
def acknowledge_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = acknowledge_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(incident, regressions, representative_traces, baseline_traces),
    )


@router.post("/incidents/{incident_id}/owner", response_model=IncidentDetailRead)
def assign_incident_owner_endpoint(
    incident_id: UUID,
    payload: IncidentOwnerAssignRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = assign_incident_owner(
        db,
        operator,
        incident_id=incident_id,
        owner_operator_user_id=payload.owner_operator_user_id,
    )
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(incident, regressions, representative_traces, baseline_traces),
    )


@router.post("/incidents/{incident_id}/resolve", response_model=IncidentDetailRead)
def resolve_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = resolve_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(incident, regressions, representative_traces, baseline_traces),
    )


@router.post("/incidents/{incident_id}/reopen", response_model=IncidentDetailRead)
def reopen_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = reopen_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(incident, regressions, representative_traces, baseline_traces),
    )


@router.get("/incidents/{incident_id}/alerts", response_model=AlertDeliveryListResponse)
def list_incident_alerts_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> AlertDeliveryListResponse:
    deliveries = get_incident_alert_deliveries(db, operator, incident_id)
    return AlertDeliveryListResponse(items=[AlertDeliveryRead.model_validate(item) for item in deliveries])


@router.get("/incidents/{incident_id}/events", response_model=IncidentEventListResponse)
def list_incident_events_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentEventListResponse:
    events = get_incident_events(db, operator, incident_id)
    return IncidentEventListResponse(items=[_incident_event_item(event) for event in events])


@router.get("/incidents/{incident_id}/compare", response_model=TraceComparisonRead)
def get_incident_trace_compare_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceComparisonRead:
    incident = get_incident_detail(db, operator, incident_id)
    current_traces, baseline_traces = get_incident_compare_traces(db, incident)
    summary = incident.summary_json or {}
    prompt_version_contexts, model_version_contexts = derive_registry_contexts(
        project_id=incident.project_id,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )
    return _trace_comparison_item(
        comparison_scope="incident",
        source_id=incident.id,
        incident_id=incident.id,
        regression_id=None,
        project_id=incident.project_id,
        metric_name=summary.get("metric_name"),
        scope_type=summary.get("scope_type"),
        scope_id=summary.get("scope_id"),
        current_window_start=summary.get("current_window_start"),
        current_window_end=summary.get("current_window_end"),
        baseline_window_start=summary.get("baseline_window_start"),
        baseline_window_end=summary.get("baseline_window_end"),
        current_traces=current_traces,
        baseline_traces=baseline_traces,
        dimension_summaries=derive_dimension_summaries(
            current_traces=current_traces,
            baseline_traces=baseline_traces,
        ),
        prompt_version_contexts=prompt_version_contexts,
        model_version_contexts=model_version_contexts,
        cohort_pivots=build_cohort_pivots(
            project_id=incident.project_id,
            scope_type=summary.get("scope_type"),
            scope_id=summary.get("scope_id"),
            current_window_start=_read_datetime(summary.get("current_window_start")),
            current_window_end=_read_datetime(summary.get("current_window_end")),
            anchor_time=incident.started_at,
            current_traces=current_traces,
        ),
        related_incident_id=incident.id,
    )


@router.get("/projects/{project_id}/regressions", response_model=RegressionListResponse)
def list_project_regressions_endpoint(
    project_id: UUID,
    query: RegressionListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> RegressionListResponse:
    regressions = list_project_regressions(db, operator, project_id=project_id, query=query)
    return RegressionListResponse(
        items=[RegressionSnapshotRead.model_validate(regression) for regression in regressions]
    )


@router.get("/regressions/{regression_id}", response_model=RegressionDetailRead)
def get_regression_detail_endpoint(
    regression_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> RegressionDetailRead:
    result = get_regression_detail(db, operator, regression_id=regression_id)
    regression = result.regression
    related_incident = result.related_incident
    return RegressionDetailRead(
        **RegressionSnapshotRead.model_validate(regression).model_dump(),
        related_incident=RegressionRelatedIncidentRead(
            id=related_incident.id,
            incident_type=related_incident.incident_type,
            severity=related_incident.severity,
            status=related_incident.status,
            title=related_incident.title,
            started_at=related_incident.started_at,
            updated_at=related_incident.updated_at,
        )
        if related_incident is not None
        else None,
        root_cause_hints=[_root_cause_hint_item(hint) for hint in result.root_cause_hints],
        dimension_summaries=[
            _dimension_summary_item(summary) for summary in result.dimension_summaries
        ],
        prompt_version_contexts=[
            _prompt_version_context_item(item) for item in result.prompt_version_contexts
        ],
        model_version_contexts=[
            _model_version_context_item(item) for item in result.model_version_contexts
        ],
        cohort_pivots=[_cohort_pivot_item(pivot) for pivot in result.cohort_pivots],
        current_representative_traces=[
            _trace_compare_item(trace) for trace in result.current_representative_traces
        ],
        baseline_representative_traces=[
            _trace_compare_item(trace) for trace in result.baseline_representative_traces
        ],
        trace_compare_path=f"/regressions/{regression.id}/compare",
    )


@router.get("/regressions/{regression_id}/compare", response_model=TraceComparisonRead)
def get_regression_compare_endpoint(
    regression_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceComparisonRead:
    result = get_regression_compare(db, operator, regression_id=regression_id)
    regression = result.regression
    metadata = regression.metadata_json or {}
    return _trace_comparison_item(
        comparison_scope="regression",
        source_id=regression.id,
        incident_id=None,
        regression_id=regression.id,
        project_id=regression.project_id,
        metric_name=regression.metric_name,
        scope_type=regression.scope_type,
        scope_id=regression.scope_id,
        current_window_start=metadata.get("current_window_start"),
        current_window_end=metadata.get("current_window_end"),
        baseline_window_start=metadata.get("baseline_window_start"),
        baseline_window_end=metadata.get("baseline_window_end"),
        current_traces=result.current_representative_traces,
        baseline_traces=result.baseline_representative_traces,
        dimension_summaries=result.dimension_summaries,
        prompt_version_contexts=result.prompt_version_contexts,
        model_version_contexts=result.model_version_contexts,
        cohort_pivots=result.cohort_pivots,
        related_incident_id=result.related_incident.id if result.related_incident is not None else None,
    )


@router.get("/traces", response_model=TraceListResponse)
def list_traces_endpoint(
    filters: TraceListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceListResponse:
    if filters.project_id is not None:
        require_project_access(db, operator, filters.project_id)
    result = list_traces(db, operator, filters)
    return TraceListResponse(items=result.items, next_cursor=result.next_cursor)


@router.get("/traces/{trace_id}", response_model=TraceDetailRead)
def get_trace_detail_endpoint(
    trace_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceDetailRead:
    trace = get_trace_detail(db, operator, trace_id)
    registry_pivots = []
    if trace.prompt_version_record is not None:
        traces_path, regressions_path, incidents_path = build_prompt_version_path(
            project_id=trace.project_id,
            prompt_version_id=trace.prompt_version_record.id,
            version=trace.prompt_version_record.version,
        )
        registry_pivots.extend(
            [
                CohortPivotRead(
                    pivot_type="prompt_version_traces",
                    label=f"Traces for prompt {trace.prompt_version_record.version}",
                    path=traces_path,
                    query_params={"project_id": str(trace.project_id), "prompt_version_id": str(trace.prompt_version_record.id)},
                ),
                CohortPivotRead(
                    pivot_type="prompt_version_regressions",
                    label=f"Regressions for prompt {trace.prompt_version_record.version}",
                    path=regressions_path,
                    query_params={"scope_id": trace.prompt_version_record.version},
                ),
                CohortPivotRead(
                    pivot_type="prompt_version_incidents",
                    label=f"Incidents for prompt {trace.prompt_version_record.version}",
                    path=incidents_path,
                    query_params={
                        "project_id": str(trace.project_id),
                        "scope_type": "prompt_version",
                        "scope_id": trace.prompt_version_record.version,
                    },
                ),
            ]
        )
    if trace.model_version_record is not None:
        model_path = build_model_version_path(project_id=trace.project_id, model_version_id=trace.model_version_record.id)
        registry_pivots.append(
            CohortPivotRead(
                pivot_type="model_version_traces",
                label=f"Traces for model {trace.model_version_record.model_name}",
                path=model_path,
                query_params={"project_id": str(trace.project_id), "model_version_id": str(trace.model_version_record.id)},
            )
        )
    return _trace_detail_item(trace, registry_pivots, f"/traces/{trace.id}/compare")


@router.get("/traces/{trace_id}/compare", response_model=TraceComparisonRead)
def get_trace_compare_endpoint(
    trace_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceComparisonRead:
    result = get_trace_compare(db, operator, trace_id)
    prompt_version_contexts, model_version_contexts = derive_registry_contexts(
        project_id=result.trace.project_id,
        current_traces=[result.trace],
        baseline_traces=[result.baseline_trace] if result.baseline_trace is not None else [],
    )
    return _trace_comparison_item(
        comparison_scope="trace",
        source_id=result.trace.id,
        incident_id=None,
        regression_id=None,
        project_id=result.trace.project_id,
        metric_name=None,
        scope_type="trace",
        scope_id=result.trace.request_id,
        current_window_start=result.current_window_start,
        current_window_end=result.current_window_end,
        baseline_window_start=result.baseline_window_start,
        baseline_window_end=result.baseline_window_end,
        current_traces=[result.trace],
        baseline_traces=[result.baseline_trace] if result.baseline_trace is not None else [],
        dimension_summaries=derive_dimension_summaries(
            current_traces=[result.trace],
            baseline_traces=[result.baseline_trace] if result.baseline_trace is not None else [],
        ),
        prompt_version_contexts=prompt_version_contexts,
        model_version_contexts=model_version_contexts,
        cohort_pivots=build_cohort_pivots(
            project_id=result.trace.project_id,
            scope_type="prompt_version" if result.trace.prompt_version is not None else None,
            scope_id=result.trace.prompt_version,
            current_window_start=result.baseline_window_start,
            current_window_end=result.current_window_end,
            anchor_time=result.trace.timestamp,
            current_traces=[result.trace],
        ),
        related_incident_id=None,
    )


@router.post(
    "/projects/{project_id}/api-keys",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key_endpoint(
    project_id: UUID,
    payload: APIKeyCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> APIKeyCreateResponse:
    project = require_project_access(db, operator, project_id)
    key_record, plaintext_key = create_api_key(db, project.id, payload)
    return APIKeyCreateResponse(
        api_key=plaintext_key, api_key_record=APIKeyRead.model_validate(key_record)
    )


@router.post(
    "/ingest/traces",
    response_model=TraceAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def ingest_trace_endpoint(
    payload: TraceIngestRequest,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> TraceAcceptedResponse:
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key is required"
        )
    api_key = authenticate_api_key(db, provided_key)
    if api_key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    trace = ingest_trace(db, api_key, payload)
    return TraceAcceptedResponse(trace_id=trace.id)
