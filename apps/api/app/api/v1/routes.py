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
from app.schemas.investigation import RootCauseHintRead
from app.schemas.incident_event import IncidentEventListResponse, IncidentEventRead
from app.schemas.organization import OrganizationCreate, OrganizationRead
from app.schemas.organization_alert_target import (
    OrganizationAlertTargetRead,
    OrganizationAlertTargetTestResponse,
    OrganizationAlertTargetUpsertRequest,
)
from app.schemas.project import ProjectCreate, ProjectListQuery, ProjectListResponse, ProjectRead
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
    get_incident_alert_deliveries,
    get_incident_detail,
    get_incident_events,
    get_incident_compare_traces,
    get_incident_regressions,
    get_incident_representative_traces,
    get_incident_rule,
    get_incident_traces,
    list_incidents,
    reopen_incident,
    resolve_incident,
    build_trace_compare_item,
    derive_root_cause_hints,
)
from app.services.regressions import get_regression_detail, list_project_regressions
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
from app.services.traces import get_trace_detail, ingest_trace, list_traces

router = APIRouter()


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


def _trace_compare_item(trace) -> TraceCompareItemRead:
    return TraceCompareItemRead.model_validate(build_trace_compare_item(trace))


def _trace_comparison_item(incident, current_traces, baseline_traces) -> TraceComparisonRead:
    summary = incident.summary_json or {}
    current_items = [_trace_compare_item(trace) for trace in current_traces]
    baseline_items = [_trace_compare_item(trace) for trace in baseline_traces]
    pair_count = max(len(current_items), len(baseline_items))
    pairs = [
        TraceComparePairRead(
            pair_index=index,
            current_trace=current_items[index] if index < len(current_items) else None,
            baseline_trace=baseline_items[index] if index < len(baseline_items) else None,
        )
        for index in range(pair_count)
    ]
    return TraceComparisonRead(
        incident_id=incident.id,
        project_id=incident.project_id,
        metric_name=summary.get("metric_name"),
        scope_type=summary.get("scope_type"),
        scope_id=summary.get("scope_id"),
        current_window_start=summary.get("current_window_start"),
        current_window_end=summary.get("current_window_end"),
        baseline_window_start=summary.get("baseline_window_start"),
        baseline_window_end=summary.get("baseline_window_end"),
        current_traces=current_items,
        baseline_traces=baseline_items,
        pairs=pairs,
    )


def _incident_compare_item(incident, regressions, representative_traces, baseline_traces) -> IncidentCompareRead:
    summary = incident.summary_json or {}
    rule = get_incident_rule(incident.incident_type)
    root_cause_hints = derive_root_cause_hints(
        incident=incident,
        current_traces=representative_traces,
        baseline_traces=baseline_traces,
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
    return _trace_comparison_item(incident, current_traces, baseline_traces)


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
        current_representative_traces=[
            _trace_compare_item(trace) for trace in result.current_representative_traces
        ],
        baseline_representative_traces=[
            _trace_compare_item(trace) for trace in result.baseline_representative_traces
        ],
        trace_compare_path=f"/incidents/{related_incident.id}/compare" if related_incident is not None else None,
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
    return get_trace_detail(db, operator, trace_id)


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
