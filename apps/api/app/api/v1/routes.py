from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import require_operator
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.deployment import Deployment
from app.models.model_version import ModelVersion
from app.models.organization import Organization
from app.models.prompt_version import PromptVersion
from app.models.project import Project
from app.models.reliability_graph_edge import ReliabilityGraphEdge
from app.models.reliability_graph_node import ReliabilityGraphNode
from app.schemas.api_key import APIKeyCreate, APIKeyCreateResponse, APIKeyRead
from app.schemas.alert_delivery import AlertDeliveryListResponse, AlertDeliveryRead
from app.schemas.archive_status import ArchiveStatusRead
from app.schemas.auth import (
    AuthSessionResponse,
    AuthSignInRequest,
    AuthSwitchOrganizationRequest,
    OperatorMembershipRead,
    OperatorRead,
)
from app.schemas.billing import BillingCheckoutRequest, BillingCheckoutResponse
from app.schemas.config import ConfigApplyRequest, ConfigApplyResponse, ConfigUndoRequest, ConfigSnapshotRead
from app.schemas.cost_intelligence import (
    CostAnomalyRead,
    CostByModelRead,
    DailyCostPointRead,
    ProjectCostRead,
)
from app.schemas.dashboard import (
    DashboardChangeFeedRead,
    DashboardChangeRead,
    DashboardIncidentActivityItem,
    DashboardIncidentAttentionItem,
    DashboardInvestigationLinks,
    DashboardTriageContext,
    DashboardTriageRead,
)
from app.schemas.customer_export import CustomerExportCreate, CustomerExportRead
from app.schemas.customer_reliability import (
    CustomerReliabilityDetailRead,
    CustomerReliabilityListRead,
    CustomerReliabilityProjectRead,
)
from app.schemas.customer_expansion_metrics import SystemCustomerExpansionRead
from app.schemas.custom_metric import (
    ProjectCustomMetricCreate,
    ProjectCustomMetricListResponse,
    ProjectCustomMetricRead,
    ProjectCustomMetricUpdate,
)
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentDetailRead,
    DeploymentGateRead,
    DeploymentRegressionRiskRead,
    DeploymentIntelligencePatternRead,
    DeploymentIntelligenceRead,
    DeploymentEventRead,
    DeploymentListResponse,
    DeploymentRiskRead,
    DeploymentRead,
    DeploymentRollbackRead,
    DeploymentSimulationCreate,
    DeploymentSimulationRead,
    IncidentDeploymentContextRead,
)
from app.schemas.environment import EnvironmentCreate, EnvironmentListResponse, EnvironmentRead
from app.schemas.event_pipeline import (
    EventPipelineConsumerRead,
    EventPipelineRead,
    EventPipelineResponse,
)
from app.schemas.external_processor import (
    ExternalProcessorCreate,
    ExternalProcessorListResponse,
    ExternalProcessorRead,
    ExternalProcessorUpdate,
)
from app.schemas.global_metrics import (
    GlobalModelReliabilityListResponse,
    GlobalModelReliabilityMetricRead,
    GlobalModelReliabilityRead,
)
from app.schemas.github_integration import GitHubCommentWebhookRead, GitHubWebhookProcessRead
from app.schemas.growth_metrics import SystemGrowthRead
from app.schemas.platform_extension import (
    PlatformExtensionCreate,
    PlatformExtensionListResponse,
    PlatformExtensionRead,
)
from app.schemas.platform_metrics import PlatformMetricsRead
from app.schemas.public_api_key import (
    PublicAPIKeyCreate,
    PublicAPIKeyCreateResponse,
    PublicAPIKeyListResponse,
    PublicAPIKeyRead,
)
from app.schemas.sdk_metric import SDKTelemetryEventCreate
from app.schemas.scheduler import SchedulerJobRead, SchedulerStatusResponse
from app.schemas.support_debug import SupportDebugRead
from app.schemas.upgrade_prompt import UpgradeRequiredResponse
from app.schemas.usage_quota import UsageQuotaRead, UsageQuotaStatusRead, UsageQuotaUpsert
from app.schemas.guardrail_metrics import (
    GuardrailMetricsRead,
    GuardrailPolicyMetricsRead,
    GuardrailRuntimeEventSummaryRead,
)
from app.schemas.guardrail import GuardrailPolicyCreate, GuardrailPolicyListResponse, GuardrailPolicyRead
from app.schemas.reliability_control_panel import (
    ProjectReliabilityControlPanelRead,
)
from app.schemas.reliability_action import ReliabilityActionLogListResponse, ReliabilityActionLogRead
from app.schemas.reliability_recommendation import ReliabilityRecommendationRead
from app.schemas.runtime_guardrail import (
    RuntimeGuardrailEventCreate,
    RuntimeGuardrailEventRead,
    RuntimeGuardrailPolicyListResponse,
    RuntimeGuardrailPolicyRead,
)
from app.schemas.incident import (
    GuardrailActivityRead,
    IncidentCommandCenterRead,
    IncidentCommandCenterRootCauseRead,
    IncidentCommandCenterMetricRead,
    IncidentCommandTraceCompareRead,
    IncidentCompareRead,
    IncidentDetailRead,
    IncidentInvestigationRead,
    IncidentInvestigationRootCauseRead,
    IncidentInvestigationTraceComparisonRead,
    IncidentListItemRead,
    IncidentListQuery,
    IncidentListResponse,
    InvestigationDeploymentContextRead,
    InvestigationKeyDifferenceRead,
    InvestigationRecommendationRead,
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
from app.schemas.membership import (
    OrganizationMemberCreate,
    OrganizationMemberListResponse,
    OrganizationMemberRead,
    ProjectMemberCreate,
    ProjectMemberListResponse,
    ProjectMemberRead,
)
from app.schemas.organization import OrganizationCreate, OrganizationRead
from app.schemas.organization_alert_target import (
    OrganizationAlertTargetRead,
    OrganizationAlertTargetTestResponse,
    OrganizationAlertTargetUpsertRequest,
)
from app.schemas.organization_guardrail import (
    OrganizationGuardrailPolicyListResponse,
    OrganizationGuardrailPolicyRead,
    PolicyViolationEventCreate,
)
from app.schemas.onboarding_simulation import (
    OnboardingSimulationCreate,
    OnboardingSimulationCreateResponse,
    OnboardingSimulationStatusRead,
)
from app.schemas.prompt_diff import PromptDiffRead
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
from app.schemas.reliability_intelligence import (
    GuardrailEffectivenessListResponse,
    GuardrailEffectivenessRead,
    ModelReliabilityPatternListResponse,
    ModelReliabilityPatternRead,
    PromptFailurePatternListResponse,
    PromptFailurePatternRead,
)
from app.schemas.reliability_pattern import ReliabilityPatternListResponse, ReliabilityPatternRead
from app.schemas.reliability_graph import (
    GraphGuardrailRecommendationListResponse,
    GraphGuardrailRecommendationRead,
    GlobalReliabilityPatternListResponse,
    ReliabilityGraphEdgeRead,
    ReliabilityGraphNodeDetailRead,
    ReliabilityGraphNodeRead,
    ReliabilityGraphOverviewRead,
    ReliabilityGraphPatternListResponse,
    ReliabilityGraphPatternRead,
    ReliabilityGraphRelatedNodeRead,
    GraphIncidentRootCauseRead,
    GraphTraceEvaluationRead,
    GraphTraceRead,
    GraphTraceRetrievalSpanRead,
    IncidentGraphRead,
)
from app.schemas.regression import (
    RegressionDetailRead,
    RegressionListQuery,
    RegressionListResponse,
    RegressionRelatedIncidentRead,
    RegressionSnapshotRead,
)
from app.schemas.root_cause_analysis import (
    IncidentAnalysisRead,
    IncidentAnalysisResponse,
    RootCauseProbabilityRead,
    RootCauseRecommendedFixRead,
)
from app.schemas.trace import (
    TraceCompareItemRead,
    TraceComparePairRead,
    TraceComparisonRead,
    TraceAcceptedResponse,
    TraceDetailRead,
    TraceGraphAnalysisRead,
    TraceGraphAnalysisSpanRead,
    TraceGraphEdgeRead,
    TraceGraphNodeRead,
    TraceGraphRead,
    TraceIngestRequest,
    TraceListItemRead,
    TraceListQuery,
    TraceListResponse,
    TraceReplayRead,
    TraceReplayStepRead,
    TraceSummaryRead,
)
from app.schemas.trace_cohort import (
    TraceCohortMetricsRead,
    TraceCohortRequest,
    TraceCohortResponse,
)
from app.schemas.timeline import TimelineEventRead, TimelineResponse
from app.schemas.trace_ingestion_policy import (
    MetadataCardinalityRead,
    TraceIngestionPolicyRead,
    TraceIngestionPolicyUpdate,
)
from app.services.api_keys import authenticate_api_key, create_api_key
from app.services.cohort_queries import aggregate_cohort_metrics, query_trace_cohort
from app.services.cost_intelligence import get_project_cost_intelligence
from app.services.customer_exports import create_customer_export, get_customer_export
from app.services.customer_reliability_metrics import (
    get_customer_reliability_project_detail,
    list_customer_reliability_projects,
)
from app.services.customer_expansion_metrics import get_customer_expansion_metrics
from app.services.custom_metrics import (
    create_project_custom_metric,
    list_project_custom_metrics,
    set_project_custom_metric_enabled,
)
from app.services.deployments import (
    create_deployment,
    get_deployment_detail,
    get_deployment_gate_result,
    get_deployment_intelligence,
    list_project_deployments,
)
from app.services.environments import create_environment, list_project_environments, resolve_project_environment
from app.services.event_processing_metrics import get_event_pipeline_status
from app.services.external_processors import (
    create_external_processor,
    list_project_external_processors,
    processor_read_model,
    update_external_processor,
)
from app.services.platform_extensions import (
    create_platform_extension,
    extension_read_model,
    list_platform_extensions,
    list_system_platform_extensions,
)
from app.services.deployment_simulation_engine import create_deployment_simulation
from app.services.deployment_risk_engine import calculate_deployment_risk
from app.services.global_metrics import list_global_model_reliability
from app.services.growth_metrics import get_growth_metrics
from app.services.guardrail_metrics import get_guardrail_policy_metrics, get_recent_guardrail_events
from app.services.guardrail_metrics import get_trace_guardrail_policy_counts
from app.services.guardrails import (
    create_guardrail_policy,
    get_active_guardrail_policies,
    list_guardrail_policies,
    record_runtime_guardrail_event,
)
from app.integrations.github_bot import process_github_comment_webhook, verify_github_signature
from app.services.auth import (
    OperatorContext,
    get_operator_context,
    get_operator_memberships,
    revoke_session,
    set_active_organization,
    sign_in_operator,
)
from app.services.auth_workos import (
    handle_scim_group_updated,
    handle_scim_user_deprovisioned,
    handle_scim_user_provisioned,
)
from app.services.incident_command_center import get_incident_command_center
from app.services.incident_investigation import compute_prompt_content_diff, get_incident_investigation
from app.services.incidents import (
    acknowledge_incident,
    assign_incident_owner,
    append_incident_event,
    build_resolution_impact_baseline,
    build_cohort_pivots,
    build_trace_compare_item,
    build_trace_diff_blocks,
    derive_dimension_summaries,
    derive_incident_registry_contexts,
    derive_registry_contexts,
    derive_root_cause_hints,
    INCIDENT_EVENT_CONFIG_APPLIED,
    INCIDENT_EVENT_CONFIG_UNDONE,
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
from app.services.root_cause_engine import get_incident_analysis
from app.services.authorization import (
    require_environment_access,
    require_organization_membership,
    require_org_role,
    require_project_access,
    require_project_role,
    require_system_admin,
)
from app.services.rbac import has_required_role
from app.services.organizations import create_organization, get_organization
from app.services.organization_alert_targets import (
    get_org_alert_target,
    org_alert_target_read_model,
    set_org_alert_target_enabled,
    test_org_alert_target,
    upsert_org_alert_target,
)
from app.services.organization_guardrails import (
    list_active_organization_guardrail_policies,
    require_api_key_organization_access,
)
from app.services.projects import create_project, list_projects
from app.services.public_api import (
    authenticate_public_api_key,
    create_public_api_key,
    list_public_api_keys,
    revoke_public_api_key,
)
from app.services.prompt_versions import get_prompt_version_detail
from app.services.prompt_versions import get_prompt_version_diff
from app.services.rate_limiter import enforce_rate_limit
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
from app.services.reliability_graph import get_incident_graph
from app.services.reliability_graph import (
    get_graph_guardrail_recommendations,
    get_high_risk_patterns,
    get_related_nodes,
)
from app.services.reliability_control_panel import get_project_reliability_control_panel
from app.services.reliability_actions import list_project_reliability_actions
from app.services.reliability_pattern_mining import get_reliability_pattern, list_reliability_patterns
from app.services.global_reliability_patterns import get_global_reliability_patterns
from app.services.reliability_recommendations import (
    generate_recommendations,
    get_active_recommendations,
)
from app.services.reliability_intelligence import (
    get_guardrail_recommendations,
    get_model_insights,
    get_prompt_risk_scores,
)
from app.services.sdk_metrics import record_sdk_event
from app.services.support_debug import get_support_debug_snapshot
from app.services.platform_metrics import get_platform_metrics
from app.services.registry import (
    build_model_version_path,
    build_prompt_version_path,
    list_project_model_versions,
    list_project_prompt_versions,
)
from app.services.model_versions import get_model_version_detail
from app.services.memberships import (
    add_organization_member,
    add_project_member,
    list_organization_members,
    list_project_members,
    remove_organization_member,
    remove_project_member,
)
from app.services.onboarding_simulations import (
    create_onboarding_simulation,
    get_onboarding_simulation,
    run_onboarding_simulation,
)
from app.services.workos_roles import normalize_org_role
from app.services.trace_ingestion_control import (
    DEFAULT_SENSITIVE_FIELD_PATTERNS,
    get_effective_ingestion_policy,
    list_metadata_cardinality,
    resolve_trace_environment,
    upsert_project_ingestion_policy,
)
from app.services.trace_graph import get_trace_graph, get_trace_graph_analysis
from app.services.trace_replay import get_trace_replay
from app.services.traces import (
    get_trace_compare,
    get_trace_detail_by_identifier,
    get_trace_summary_by_identifier,
    ingest_trace,
    list_traces,
    resolve_trace_identifier,
)
from app.services.timeline import get_project_timeline
from app.services.event_stream import PolicyViolationEventPayload, publish_event
from app.services.entitlements import has_feature
from app.services.stripe_billing import create_checkout_session, ensure_stripe_customer, handle_stripe_webhook
from app.services.organization_config import apply_config_patch, undo_config_patch
from app.services.upgrade_prompts import get_upgrade_prompt
from app.services.usage_quotas import (
    enforce_daily_api_quota,
    get_or_create_usage_quota,
    get_usage_status,
)
from app.services.warehouse_archiver import get_archive_status
from app.workers.deployment_simulation import enqueue_deployment_simulation
from app.workers.scheduler import get_scheduler_status

router = APIRouter()


def _read_datetime(value):
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


def _membership_items(db: Session, memberships) -> list[OperatorMembershipRead]:
    organization_names: dict[UUID, str] = {}
    for membership in memberships:
        if membership.organization_id in organization_names:
            continue
        organization = db.get(Organization, membership.organization_id)
        if organization is not None:
            organization_names[membership.organization_id] = organization.name
    return [
        OperatorMembershipRead(
            organization_id=membership.organization_id,
            organization_name=organization_names.get(membership.organization_id),
            role=membership.role,
        )
        for membership in memberships
    ]


def _incident_list_item(incident) -> IncidentListItemRead:
    return IncidentListItemRead(
        id=incident.id,
        organization_id=incident.organization_id,
        project_id=incident.project_id,
        environment_id=incident.environment_id,
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


def _global_model_reliability_item(item: dict) -> GlobalModelReliabilityRead:
    return GlobalModelReliabilityRead(
        provider=item["provider"],
        model_name=item["model_name"],
        metrics=[
            GlobalModelReliabilityMetricRead.model_validate(metric)
            for metric in item["metrics"]
        ],
    )


def _model_reliability_pattern_item(item) -> ModelReliabilityPatternRead:
    return ModelReliabilityPatternRead.model_validate(item)


def _prompt_failure_pattern_item(item) -> PromptFailurePatternRead:
    return PromptFailurePatternRead.model_validate(item)


def _guardrail_effectiveness_item(item) -> GuardrailEffectivenessRead:
    return GuardrailEffectivenessRead.model_validate(item)


def _reliability_pattern_item(item) -> ReliabilityPatternRead:
    return ReliabilityPatternRead.model_validate(item)


def _graph_node_item(item) -> ReliabilityGraphNodeRead:
    return ReliabilityGraphNodeRead.model_validate(item)


def _graph_edge_item(item) -> ReliabilityGraphEdgeRead:
    return ReliabilityGraphEdgeRead.model_validate(item)


def _graph_pattern_item(item: dict) -> ReliabilityGraphPatternRead:
    return ReliabilityGraphPatternRead.model_validate(item)


def _deployment_item(deployment) -> DeploymentRead:
    return DeploymentRead.model_validate(deployment)


def _deployment_event_item(event) -> DeploymentEventRead:
    return DeploymentEventRead.model_validate(event)


def _deployment_rollback_item(rollback) -> DeploymentRollbackRead:
    return DeploymentRollbackRead.model_validate(rollback)


def _deployment_risk_item(risk_score) -> DeploymentRiskRead:
    return DeploymentRiskRead(
        deployment_id=risk_score.deployment_id,
        risk_score=float(risk_score.risk_score),
        risk_level=risk_score.risk_level,
        analysis_json=risk_score.analysis_json,
        recommendations=risk_score.analysis_json.get("recommendations", []),
        created_at=risk_score.created_at,
    )


def _deployment_simulation_item(simulation) -> DeploymentSimulationRead:
    return DeploymentSimulationRead.model_validate(simulation)


def _runtime_guardrail_event_item(event) -> RuntimeGuardrailEventRead:
    return RuntimeGuardrailEventRead.model_validate(event)


def _runtime_guardrail_policy_item(policy) -> RuntimeGuardrailPolicyRead:
    config = dict(policy.config_json or {})
    action = str(config.pop("action"))
    return RuntimeGuardrailPolicyRead(
        id=policy.id,
        policy_type=policy.policy_type,
        action=action,
        config=config,
    )


def _guardrail_policy_metrics_item(item: dict) -> GuardrailPolicyMetricsRead:
    return GuardrailPolicyMetricsRead(
        policy_id=item["policy_id"],
        policy_type=item["policy_type"],
        action=item["action"],
        trigger_count=item["trigger_count"],
        last_triggered_at=item["last_triggered_at"],
    )


def _guardrail_runtime_event_summary_item(item: dict) -> GuardrailRuntimeEventSummaryRead:
    return GuardrailRuntimeEventSummaryRead(
        policy_type=item["policy_type"],
        action_taken=item["action_taken"],
        provider_model=item["provider_model"],
        latency_ms=item["latency_ms"],
        created_at=item["created_at"],
        trace_id=item["trace_id"],
        trace_available=item["trace_available"],
    )


def _guardrail_trace_policy_count_item(item: dict):
    from app.schemas.guardrail_metrics import GuardrailTracePolicyCountRead

    return GuardrailTracePolicyCountRead(
        policy_type=item["policy_type"],
        trigger_count=item["trigger_count"],
    )


def _event_pipeline_consumer_item(item) -> EventPipelineConsumerRead:
    return EventPipelineConsumerRead.model_validate(item)


def _event_pipeline_item(item) -> EventPipelineRead:
    return EventPipelineRead(
        topic=item.topic,
        dead_letter_topic=item.dead_letter_topic,
        total_events_published=item.total_events_published,
        recent_events_published=item.recent_events_published,
        window_minutes=item.window_minutes,
        consumers=[_event_pipeline_consumer_item(consumer) for consumer in item.consumers],
    )


def _deployment_intelligence_item(item: dict) -> DeploymentIntelligenceRead:
    return DeploymentIntelligenceRead(
        deployment_id=item["deployment_id"],
        risk_score=item.get("risk_score"),
        risk_explanations=[str(value) for value in item.get("risk_explanations", [])],
        graph_risk_patterns=[
            DeploymentIntelligencePatternRead(
                pattern=str(pattern["pattern"]),
                risk=str(pattern["risk"]),
                trace_count=int(pattern["trace_count"]),
            )
            for pattern in item.get("graph_risk_patterns", [])
        ],
        recommended_guardrails=[str(value) for value in item.get("recommended_guardrails", [])],
    )


def _deployment_gate_item(item: dict) -> DeploymentGateRead:
    regression = item.get("regression_risk")
    return DeploymentGateRead(
        decision=str(item["decision"]),
        risk_score=int(item["risk_score"]),
        explanations=[str(value) for value in item.get("explanations", [])],
        recommended_guardrails=[str(value) for value in item.get("recommended_guardrails", [])],
        regression_risk=DeploymentRegressionRiskRead(
            is_regression=bool(regression.get("is_regression")),
            reasons=[str(value) for value in regression.get("reasons", [])],
        )
        if isinstance(regression, dict)
        else None,
    )


def _reliability_recommendation_item(item) -> ReliabilityRecommendationRead:
    return ReliabilityRecommendationRead(
        id=item.id,
        project_id=item.project_id,
        type=item.recommendation_type,
        severity=item.severity,
        title=item.title,
        description=item.description,
        evidence_json=item.evidence_json,
        created_at=item.created_at,
    )


def _reliability_action_log_item(item) -> ReliabilityActionLogRead:
    return ReliabilityActionLogRead.model_validate(item)


def _public_api_key_item(item) -> PublicAPIKeyRead:
    return PublicAPIKeyRead.model_validate(item)


def _organization_guardrail_policy_item(item) -> OrganizationGuardrailPolicyRead:
    return OrganizationGuardrailPolicyRead.model_validate(item)


def _platform_extension_item(db: Session, item) -> PlatformExtensionRead:
    payload = item if isinstance(item, dict) else extension_read_model(db, item)
    return PlatformExtensionRead.model_validate(payload)


def _project_from_session_or_api_key(
    *,
    db: Session,
    project_id: UUID,
    x_api_key: str | None,
    authorization: str | None,
):
    if x_api_key:
        api_key = authenticate_api_key(db, x_api_key)
        if api_key is not None:
            if api_key.project_id != project_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            project = db.get(Project, project_id)
            if project is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
            return project

        public_key = authenticate_public_api_key(db, x_api_key)
        if public_key is None:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if project.organization_id != public_key.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        enforce_rate_limit(
            scope="public_api",
            key=str(public_key.organization_id),
            limit=get_settings().public_api_rate_limit_per_minute,
            window_seconds=60,
        )
        enforce_daily_api_quota(db, organization_id=public_key.organization_id)
        return project

    if authorization and authorization.lower().startswith("bearer "):
        operator = get_operator_context(db, authorization[7:])
        return require_project_access(db, operator, project_id)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def _public_api_key_from_headers(
    *,
    db: Session,
    x_api_key: str | None,
    authorization: str | None,
):
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key is required")
    key = authenticate_public_api_key(db, provided_key)
    if key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return key


def _trace_replay_access_from_headers(
    *,
    db: Session,
    trace_project_id: UUID,
    trace_organization_id: UUID,
    x_api_key: str | None,
    authorization: str | None,
) -> None:
    if x_api_key:
        api_key = authenticate_api_key(db, x_api_key)
        if api_key is not None:
            if api_key.project_id != trace_project_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            return

        public_key = authenticate_public_api_key(db, x_api_key)
        if public_key is None:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        if public_key.organization_id != trace_organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        enforce_rate_limit(
            scope="public_api",
            key=str(public_key.organization_id),
            limit=get_settings().public_api_rate_limit_per_minute,
            window_seconds=60,
        )
        enforce_daily_api_quota(db, organization_id=public_key.organization_id)
        return

    if authorization and authorization.lower().startswith("bearer "):
        operator = get_operator_context(db, authorization[7:])
        require_project_access(db, operator, trace_project_id)
        return

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def _operator_context_for_public_project(project: Project):
    membership = SimpleNamespace(organization_id=project.organization_id, role="org_admin")
    return SimpleNamespace(
        operator=SimpleNamespace(id=UUID(int=0), is_system_admin=False),
        memberships=[membership],
        organization_ids=[project.organization_id],
    )


def _trace_list_item(trace) -> TraceListItemRead:
    item = TraceListItemRead.model_validate(trace)
    signals = ((trace.metadata_json or {}).get("behavior_signals") or {})
    val = signals.get("refusal_detected")
    item.refusal_detected = bool(val) if val is not None else None
    return item


def _incident_deployment_context_item(incident) -> IncidentDeploymentContextRead | None:
    deployment = getattr(incident, "deployment", None)
    if deployment is None:
        return None
    time_since_minutes = max(
        0.0,
        round((incident.started_at - deployment.deployed_at).total_seconds() / 60.0, 2),
    )
    return IncidentDeploymentContextRead(
        deployment=_deployment_item(deployment),
        prompt_version=PromptVersionRead.model_validate(deployment.prompt_version)
        if deployment.prompt_version is not None
        else None,
        model_version=ModelVersionRead.model_validate(deployment.model_version)
        if deployment.model_version is not None
        else None,
        time_since_deployment_minutes=time_since_minutes,
    )


def _incident_analysis_item(report) -> IncidentAnalysisRead:
    return IncidentAnalysisRead(
        incident_id=report.incident.id,
        generated_at=report.generated_at,
        root_cause_probabilities=[
            RootCauseProbabilityRead.model_validate(item)
            for item in report.root_cause_probabilities
        ],
        evidence=report.evidence,
        recommended_fix=RootCauseRecommendedFixRead.model_validate(report.recommended_fix),
    )


def _recommendation_meta(report) -> tuple[float | None, float | None, str | None, str | None]:
    top_probability = None
    if report.root_cause_probabilities:
        first = report.root_cause_probabilities[0]
        if isinstance(first, dict):
            top_probability = first.get("probability")
        else:
            top_probability = getattr(first, "probability", None)
    recommendation_confidence = top_probability
    recommendation_kind = None
    if top_probability is not None:
        recommendation_kind = "action" if top_probability >= 0.8 else "recommendation"
    recommended_action_reason = _recommendation_reason(report)
    return top_probability, recommendation_confidence, recommendation_kind, recommended_action_reason


def _format_ratio(value: float | None) -> str | None:
    if value is None:
        return None
    return f"{round(value * 100, 1)}%"


def _recommendation_reason(report) -> str | None:
    if not report.root_cause_probabilities:
        return None
    top = report.root_cause_probabilities[0]
    cause_type = top.get("cause_type") if isinstance(top, dict) else getattr(top, "cause_type", None)
    evidence = top.get("evidence_json") if isinstance(top, dict) else getattr(top, "evidence_json", None)
    evidence = evidence or {}
    parts: list[str] = []

    if report.regressions:
        regression = report.regressions[0]
        current = getattr(regression, "current_value", None)
        baseline = getattr(regression, "baseline_value", None)
        delta = getattr(regression, "delta_percent", None)
        metric_name = getattr(regression, "metric_name", None) or "metric"
        if current is not None and baseline is not None:
            delta_text = f" ({delta}%)" if delta is not None else ""
            parts.append(f"{metric_name} shifted from {baseline} to {current}{delta_text}.")

    if cause_type == "prompt_concentration":
        current_value = evidence.get("current_value")
        current_share = _format_ratio(evidence.get("current_share"))
        baseline_share = _format_ratio(evidence.get("baseline_share"))
        if current_value and current_share and baseline_share:
            parts.append(
                f"Prompt {current_value} share rose from {baseline_share} to {current_share} in failing traces."
            )
    elif cause_type == "model_concentration":
        current_value = evidence.get("current_value")
        current_share = _format_ratio(evidence.get("current_share"))
        baseline_share = _format_ratio(evidence.get("baseline_share"))
        if current_value and current_share and baseline_share:
            parts.append(
                f"Model {current_value} share rose from {baseline_share} to {current_share} in failing traces."
            )
    elif cause_type == "latency_change":
        current = evidence.get("current_median_latency_ms")
        baseline = evidence.get("baseline_median_latency_ms")
        if current is not None and baseline is not None:
            parts.append(f"Median latency increased from {baseline}ms to {current}ms.")
    elif cause_type == "retrieval_shift":
        current = evidence.get("current_retrieval_median_ms")
        baseline = evidence.get("baseline_retrieval_median_ms")
        if current is not None and baseline is not None:
            parts.append(f"Retrieval latency increased from {baseline}ms to {current}ms.")
    elif cause_type == "deployment_risk_correlation":
        risk_level = evidence.get("risk_level")
        risk_score = evidence.get("risk_score")
        if risk_level and risk_score is not None:
            parts.append(f"Deployment risk score {risk_score} ({risk_level}) overlaps incident timing.")
    elif cause_type == "error_cluster":
        error_type = evidence.get("error_type")
        share = _format_ratio(evidence.get("current_share"))
        if error_type and share:
            parts.append(f"Error {error_type} accounts for {share} of failing traces.")

    if not parts:
        label = top.get("label") if isinstance(top, dict) else getattr(top, "label", None)
        if label:
            return f"Root-cause evidence concentrates on {label.lower()}."
        return None
    return " ".join(parts)


_METRIC_DISPLAY_NAMES: dict[str, str] = {
    "refusal_rate": "Refusal rate",
    "success_rate": "Success rate",
    "structured_output_validity_pass_rate": "Structured output validity",
    "p95_latency_ms": "P95 latency",
    "median_latency_ms": "Median latency",
    "average_cost_usd_per_trace": "Cost per trace",
}


def _metric_display_name(metric_name: str, summary: dict) -> str:
    if metric_name in _METRIC_DISPLAY_NAMES:
        return _METRIC_DISPLAY_NAMES[metric_name]
    if metric_name.startswith("custom_metric."):
        stored = summary.get("custom_metric_name")
        if stored:
            return f"{stored} rate"
        key = metric_name.removeprefix("custom_metric.").removesuffix("_rate")
        return key.replace("_", " ").title() + " rate"
    return metric_name.replace("_", " ").replace(".", " ").title()


def _incident_command_metric_item(incident) -> IncidentCommandCenterMetricRead | None:
    summary = incident.summary_json or {}
    metric_name = summary.get("metric_name")
    if not metric_name:
        return None
    metric_name = str(metric_name)
    metric_type = "custom"
    unit = None
    if "latency" in metric_name:
        metric_type = "latency"
        unit = "ms"
    elif (
        "success_rate" in metric_name
        or "error_rate" in metric_name
        or "validity" in metric_name
        or "refusal_rate" in metric_name
    ):
        metric_type = "error_rate"
        unit = "%"
    elif "retry" in metric_name:
        metric_type = "retry_rate"
        unit = "%"
    elif metric_name.startswith("custom_metric."):
        metric_type = "error_rate"
        unit = "%"

    def _stringify(value) -> str | None:
        if value is None:
            return None
        return str(value)

    return IncidentCommandCenterMetricRead(
        metric_name=metric_name,
        metric_type=metric_type,
        display_name=_metric_display_name(metric_name, summary),
        unit=unit,
        value=_stringify(summary.get("current_value")),
        baseline_value=_stringify(summary.get("baseline_value")),
        delta_percent=_stringify(summary.get("delta_percent")),
    )


def _incident_command_root_cause_item(report) -> IncidentCommandCenterRootCauseRead:
    (
        top_probability,
        recommendation_confidence,
        recommendation_kind,
        recommended_action_reason,
    ) = _recommendation_meta(report)
    return IncidentCommandCenterRootCauseRead(
        incident_id=report.incident.id,
        generated_at=report.generated_at,
        root_cause_probabilities=[
            RootCauseProbabilityRead.model_validate(item)
            for item in report.root_cause_probabilities
        ],
        evidence=report.evidence,
        recommended_fix=RootCauseRecommendedFixRead.model_validate(report.recommended_fix),
        top_root_cause_probability=top_probability,
        recommendation_confidence=recommendation_confidence,
        recommendation_kind=recommendation_kind,
        recommended_action_reason=recommended_action_reason,
    )


def _incident_investigation_root_cause_item(report) -> IncidentInvestigationRootCauseRead:
    (
        top_probability,
        recommendation_confidence,
        recommendation_kind,
        recommended_action_reason,
    ) = _recommendation_meta(report)
    return IncidentInvestigationRootCauseRead(
        incident_id=report.incident.id,
        generated_at=report.generated_at,
        ranked_causes=[RootCauseProbabilityRead.model_validate(item) for item in report.root_cause_probabilities],
        evidence=report.evidence,
        recommended_fix=RootCauseRecommendedFixRead.model_validate(report.recommended_fix),
        top_root_cause_probability=top_probability,
        recommendation_confidence=recommendation_confidence,
        recommendation_kind=recommendation_kind,
        recommended_action_reason=recommended_action_reason,
    )


def _investigation_recommendation_item(item) -> InvestigationRecommendationRead:
    return InvestigationRecommendationRead(
        recommendation_id=item.recommendation.id if item.recommendation is not None else None,
        recommended_action=item.recommended_action,
        confidence=item.confidence,
        supporting_evidence=item.supporting_evidence,
    )


def _trace_ingestion_policy_item(db: Session, project: Project) -> TraceIngestionPolicyRead:
    environment = resolve_trace_environment(db, project=project)
    policy = get_effective_ingestion_policy(
        db,
        project_id=project.id,
        environment_id=environment.id if environment is not None else None,
    )
    cardinality = list_metadata_cardinality(
        db,
        project_id=project.id,
        environment_id=environment.id if environment is not None else None,
    )
    return TraceIngestionPolicyRead(
        project_id=policy.project_id,
        environment_id=policy.environment_id,
        sampling_success_rate=policy.sampling_success_rate,
        sampling_error_rate=policy.sampling_error_rate,
        max_metadata_fields=policy.max_metadata_fields,
        max_cardinality_per_field=policy.max_cardinality_per_field,
        retention_days_success=policy.retention_days_success,
        retention_days_error=policy.retention_days_error,
        created_at=policy.created_at,
        sensitive_field_patterns=DEFAULT_SENSITIVE_FIELD_PATTERNS,
        cardinality_summary=[
            MetadataCardinalityRead(
                field_name=item.field_name,
                unique_values_count=item.unique_values_count,
                limit_reached=item.unique_values_count >= policy.max_cardinality_per_field,
            )
            for item in cardinality
        ],
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


def _guardrail_activity_item(item) -> GuardrailActivityRead:
    return GuardrailActivityRead(
        policy_type=item.policy_type,
        trigger_count=item.trigger_count,
        last_trigger_time=item.last_trigger_time,
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


def _graph_trace_evaluation_item(item) -> GraphTraceEvaluationRead:
    return GraphTraceEvaluationRead.model_validate(item)


def _graph_trace_item(trace) -> GraphTraceRead:
    return GraphTraceRead(
        id=trace.id,
        request_id=trace.request_id,
        timestamp=trace.timestamp,
        success=trace.success,
        error_type=trace.error_type,
        latency_ms=trace.latency_ms,
        prompt_version=trace.prompt_version,
        model_name=trace.model_name,
        prompt_version_record=PromptVersionRead.model_validate(trace.prompt_version_record)
        if trace.prompt_version_record is not None
        else None,
        model_version_record=ModelVersionRead.model_validate(trace.model_version_record)
        if trace.model_version_record is not None
        else None,
        retrieval_span=GraphTraceRetrievalSpanRead.model_validate(trace.graph_retrieval_span)
        if trace.graph_retrieval_span is not None
        else None,
        evaluations=[_graph_trace_evaluation_item(item) for item in trace.graph_evaluations],
    )


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
    refusal_detected = None
    custom_metric_results = []
    for evaluation in trace.evaluations:
        raw = evaluation.raw_result_json or {}
        if evaluation.eval_type == "refusal_detection":
            value = raw.get("result_value")
            refusal_detected = bool(value) if isinstance(value, (bool, int, float)) else evaluation.label == "fail"
            continue
        if not evaluation.eval_type.startswith("custom_metric:"):
            continue
        custom_metric_results.append(
            {
                "metric_key": raw.get("metric_key"),
                "name": raw.get("metric_name") or evaluation.eval_type,
                "mode": raw.get("value_mode") or "boolean",
                "value": raw.get("result_value"),
                "matched": bool(raw.get("result_value")),
            }
        )

    return TraceDetailRead(
        id=trace.id,
        organization_id=trace.organization_id,
        project_id=trace.project_id,
        environment=trace.environment,
        timestamp=trace.timestamp,
        request_id=trace.request_id,
        trace_id=trace.trace_id,
        span_id=trace.span_id,
        parent_span_id=trace.parent_span_id,
        span_name=trace.span_name,
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
        guardrail_policy=trace.guardrail_policy,
        guardrail_action=trace.guardrail_action,
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
        refusal_detected=refusal_detected,
        custom_metric_results=custom_metric_results,
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
    prompt_content_diff,
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
        prompt_content_diff=prompt_content_diff,
    )


def _reliability_metric_point_item(metric) -> ReliabilityMetricPointRead:
    return ReliabilityMetricPointRead.model_validate(metric)


def _reliability_series_item(metric_name: str, metrics) -> ReliabilityMetricSeriesRead:
    return ReliabilityMetricSeriesRead(
        metric_name=metric_name,
        unit=metrics[0].unit if metrics else "ratio",
        points=[_reliability_metric_point_item(metric) for metric in metrics],
    )


def _incident_compare_item(db, incident, regressions, representative_traces, baseline_traces) -> IncidentCompareRead:
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
    prompt_version_contexts, model_version_contexts = derive_incident_registry_contexts(
        db,
        incident=incident,
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


def _incident_detail_item(
    db,
    incident,
    regressions,
    traces,
    events,
    representative_traces,
    baseline_traces,
) -> IncidentDetailRead:
    item = _incident_list_item(incident)
    return IncidentDetailRead(
        **item.model_dump(),
        regressions=[RegressionSnapshotRead.model_validate(regression) for regression in regressions],
        traces=[IncidentTraceSampleRead.model_validate(trace) for trace in traces],
        events=[_incident_event_item(event) for event in events],
        compare=_incident_compare_item(db, incident, regressions, representative_traces, baseline_traces),
        deployment_context=_incident_deployment_context_item(incident),
    )


def _dashboard_attention_item(incident) -> DashboardIncidentAttentionItem:
    return DashboardIncidentAttentionItem(
        id=incident.id,
        title=incident.title,
        severity=incident.severity,
        status=incident.status,
        project_id=incident.project_id,
        project_name=incident.project.name,
        environment_id=incident.environment_id,
        started_at=incident.started_at,
        acknowledged_at=incident.acknowledged_at,
        path=f"/incidents/{incident.id}",
    )


def _dashboard_activity_item(incident) -> DashboardIncidentActivityItem:
    return DashboardIncidentActivityItem(
        id=incident.id,
        title=incident.title,
        status=incident.status,
        project_name=incident.project.name,
        started_at=incident.started_at,
        resolved_at=incident.resolved_at,
        path=f"/incidents/{incident.id}",
    )


def _deployment_change_summary(item: Deployment) -> str:
    prompt = item.prompt_version.version if item.prompt_version is not None else None
    model = item.model_version.model_name if item.model_version is not None else None
    if prompt and model:
        return f"Deployment: {prompt} on {model}"
    if prompt:
        return f"Deployment: prompt {prompt}"
    if model:
        return f"Deployment: {model}"
    return f"Deployment to {item.environment}"


def _prompt_change_summary(item: PromptVersion) -> str:
    return f"Prompt version {item.version}"


def _model_change_summary(item: ModelVersion) -> str:
    model = item.model_name
    version = f" {item.model_version}" if item.model_version else ""
    return f"Model {model}{version}"


@router.get("/health")
def versioned_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/dashboard/triage", response_model=DashboardTriageRead)
def get_dashboard_triage_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DashboardTriageRead:
    active_org = operator.active_organization_id or (operator.organization_ids[0] if operator.organization_ids else None)
    if active_org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    attention_incidents = list_incidents(db, operator, IncidentListQuery(status="open", limit=50))
    attention_incidents = [
        incident for incident in attention_incidents if incident.organization_id == active_org
    ]
    recent_incidents = list_incidents(db, operator, IncidentListQuery(status="resolved", limit=25))
    recent_incidents = [
        incident for incident in recent_incidents if incident.organization_id == active_org
    ]

    attention_items = [_dashboard_attention_item(incident) for incident in attention_incidents[:12]]
    activity_items = [_dashboard_activity_item(incident) for incident in recent_incidents[:8]]
    unacknowledged = len([incident for incident in attention_incidents if incident.acknowledged_at is None])

    return DashboardTriageRead(
        attention=attention_items,
        recent_incident_activity=activity_items,
        investigation_links=DashboardInvestigationLinks(
            incidents="/incidents",
            traces="/traces",
            reliability=None,
        ),
        context=DashboardTriageContext(
            active_incident_count=len(attention_incidents),
            unacknowledged_incident_count=unacknowledged,
            degraded_project_count=None,
            last_updated_at=datetime.now(timezone.utc),
        ),
    )


@router.get("/dashboard/changes", response_model=DashboardChangeFeedRead)
def get_dashboard_changes_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DashboardChangeFeedRead:
    active_org = operator.active_organization_id or (operator.organization_ids[0] if operator.organization_ids else None)
    if active_org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    projects = list_projects(db, operator, ProjectListQuery(organization_id=active_org, limit=200))
    project_ids = [project.id for project in projects]
    if not project_ids:
        return DashboardChangeFeedRead(changes=[])

    project_map = {project.id: project.name for project in projects}

    deployments = db.scalars(
        select(Deployment)
        .options(selectinload(Deployment.prompt_version), selectinload(Deployment.model_version))
        .where(Deployment.project_id.in_(project_ids))
        .order_by(desc(Deployment.deployed_at), desc(Deployment.id))
        .limit(15)
    ).all()
    prompt_versions = db.scalars(
        select(PromptVersion)
        .where(PromptVersion.project_id.in_(project_ids))
        .order_by(desc(PromptVersion.updated_at), desc(PromptVersion.id))
        .limit(15)
    ).all()
    model_versions = db.scalars(
        select(ModelVersion)
        .where(ModelVersion.project_id.in_(project_ids))
        .order_by(desc(ModelVersion.updated_at), desc(ModelVersion.id))
        .limit(15)
    ).all()

    changes: list[DashboardChangeRead] = []
    for deployment in deployments:
        changes.append(
            DashboardChangeRead(
                id=deployment.id,
                project_id=deployment.project_id,
                project_name=project_map.get(deployment.project_id, "Unknown project"),
                environment=deployment.environment,
                kind="deployment",
                summary=_deployment_change_summary(deployment),
                created_at=deployment.deployed_at,
                actor=deployment.deployed_by,
                related_incident_count=len(deployment.incidents) if deployment.incidents is not None else None,
                related_regression_count=None,
                path=f"/deployments/{deployment.id}",
            )
        )

    for prompt in prompt_versions:
        changes.append(
            DashboardChangeRead(
                id=prompt.id,
                project_id=prompt.project_id,
                project_name=project_map.get(prompt.project_id, "Unknown project"),
                environment=None,
                kind="prompt",
                summary=_prompt_change_summary(prompt),
                created_at=prompt.updated_at,
                actor=None,
                related_incident_count=None,
                related_regression_count=None,
                path=f"/prompt-versions/{prompt.id}?projectId={prompt.project_id}",
            )
        )

    for model in model_versions:
        changes.append(
            DashboardChangeRead(
                id=model.id,
                project_id=model.project_id,
                project_name=project_map.get(model.project_id, "Unknown project"),
                environment=None,
                kind="model",
                summary=_model_change_summary(model),
                created_at=model.updated_at,
                actor=None,
                related_incident_count=None,
                related_regression_count=None,
                path=f"/model-versions/{model.id}?projectId={model.project_id}",
            )
        )

    changes.sort(key=lambda item: item.created_at, reverse=True)
    return DashboardChangeFeedRead(changes=changes[:25])


@router.get("/system/event-pipeline", response_model=EventPipelineResponse)
def get_event_pipeline_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> EventPipelineResponse:
    require_system_admin(operator)
    return EventPipelineResponse(pipeline=_event_pipeline_item(get_event_pipeline_status(db)))


@router.get("/system/customers", response_model=CustomerReliabilityListRead)
def get_system_customers_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> CustomerReliabilityListRead:
    require_system_admin(operator)
    items = list_customer_reliability_projects(db, operator=operator)
    return CustomerReliabilityListRead(
        projects=[CustomerReliabilityProjectRead.model_validate(item) for item in items]
    )


@router.get("/system/customers/{project_id}", response_model=CustomerReliabilityDetailRead)
def get_system_customer_detail_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> CustomerReliabilityDetailRead:
    require_system_admin(operator)
    return CustomerReliabilityDetailRead.model_validate(
        get_customer_reliability_project_detail(db, operator=operator, project_id=project_id)
    )


@router.get("/system/growth", response_model=SystemGrowthRead)
def get_system_growth_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> SystemGrowthRead:
    require_system_admin(operator)
    return SystemGrowthRead.model_validate(get_growth_metrics(db))


@router.get("/system/customer-expansion", response_model=SystemCustomerExpansionRead)
def get_system_customer_expansion_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> SystemCustomerExpansionRead:
    require_system_admin(operator)
    return SystemCustomerExpansionRead.model_validate(get_customer_expansion_metrics(db))


@router.get("/system/platform", response_model=PlatformMetricsRead)
def get_system_platform_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PlatformMetricsRead:
    require_system_admin(operator)
    return PlatformMetricsRead.model_validate(get_platform_metrics(db))


@router.get("/system/scheduler", response_model=SchedulerStatusResponse)
def get_system_scheduler_endpoint(
    operator: OperatorContext = Depends(require_operator),
) -> SchedulerStatusResponse:
    require_system_admin(operator)
    return SchedulerStatusResponse(
        jobs=[SchedulerJobRead.model_validate(item) for item in get_scheduler_status()]
    )


@router.get("/system/archive-status", response_model=ArchiveStatusRead)
def get_system_archive_status_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ArchiveStatusRead:
    require_system_admin(operator)
    return ArchiveStatusRead.model_validate(get_archive_status(db))


@router.get("/system/global-intelligence", response_model=ReliabilityGraphPatternListResponse)
def get_system_global_intelligence_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityGraphPatternListResponse:
    require_system_admin(operator)
    items = get_global_reliability_patterns(db)
    return ReliabilityGraphPatternListResponse(
        items=[
            _graph_pattern_item(
                {
                    "pattern": item["pattern"],
                    "risk_level": item["risk_level"],
                    "traces": item["trace_count"],
                    "confidence": item["confidence"],
                    "source_node_id": f"global:{item['model_family']}",
                    "target_node_id": f"global:{item['issue']}",
                    "relationship_type": "global_pattern",
                    "source_type": "model_family",
                    "source_key": item["model_family"],
                    "target_type": "pattern",
                    "target_key": item["issue"],
                }
            )
            for item in items
        ]
    )


@router.get("/system/extensions", response_model=PlatformExtensionListResponse)
def list_system_extensions_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PlatformExtensionListResponse:
    require_system_admin(operator)
    return PlatformExtensionListResponse(
        items=[_platform_extension_item(db, item) for item in list_system_platform_extensions(db)]
    )


@router.get("/intelligence/global-patterns", response_model=GlobalReliabilityPatternListResponse)
def list_global_reliability_patterns_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> GlobalReliabilityPatternListResponse:
    if not operator.operator.is_system_admin and not any(
        has_required_role(item.role, "admin") for item in operator.memberships
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return GlobalReliabilityPatternListResponse(
        patterns=[item for item in get_global_reliability_patterns(db)]
    )


@router.get("/system/debug/{project_id}", response_model=SupportDebugRead)
def get_system_debug_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> SupportDebugRead:
    require_system_admin(operator)
    require_project_access(db, operator, project_id)
    return SupportDebugRead.model_validate(get_support_debug_snapshot(db, project_id=project_id))


@router.get("/models/reliability", response_model=GlobalModelReliabilityListResponse)
def list_global_model_reliability_endpoint(
    db: Session = Depends(get_db),
) -> GlobalModelReliabilityListResponse:
    items = list_global_model_reliability(db)
    return GlobalModelReliabilityListResponse(
        items=[_global_model_reliability_item(item) for item in items]
    )


@router.get("/intelligence/models", response_model=ModelReliabilityPatternListResponse)
def list_model_intelligence_endpoint(
    db: Session = Depends(get_db),
) -> ModelReliabilityPatternListResponse:
    return ModelReliabilityPatternListResponse(
        items=[_model_reliability_pattern_item(item) for item in get_model_insights(db)]
    )


@router.get("/intelligence/prompts", response_model=PromptFailurePatternListResponse)
def list_prompt_intelligence_endpoint(
    db: Session = Depends(get_db),
) -> PromptFailurePatternListResponse:
    return PromptFailurePatternListResponse(
        items=[_prompt_failure_pattern_item(item) for item in get_prompt_risk_scores(db)]
    )


@router.get("/intelligence/guardrails", response_model=GuardrailEffectivenessListResponse)
def list_guardrail_intelligence_endpoint(
    db: Session = Depends(get_db),
) -> GuardrailEffectivenessListResponse:
    return GuardrailEffectivenessListResponse(
        items=[_guardrail_effectiveness_item(item) for item in get_guardrail_recommendations(db)]
    )


@router.get("/intelligence/graph", response_model=ReliabilityGraphOverviewRead)
def get_reliability_graph_overview_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityGraphOverviewRead:
    patterns = get_high_risk_patterns(db, organization_ids=operator.organization_ids, limit=20)
    node_ids = {UUID(item["source_node_id"]) for item in patterns} | {
        UUID(item["target_node_id"]) for item in patterns
    }
    graph_nodes: list[ReliabilityGraphNode] = []
    for node_id in node_ids:
        node, _ = get_related_nodes(db, node_id=node_id, organization_ids=operator.organization_ids)
        if node is not None:
            graph_nodes.append(node)
    edge_ids: set[UUID] = set()
    edges: list[ReliabilityGraphEdge] = []
    for item in patterns:
        _, related = get_related_nodes(
            db,
            node_id=item["source_node_id"],
            organization_ids=operator.organization_ids,
        )
        for _, edge in related:
            if edge.id in edge_ids:
                continue
            if edge.source_id == UUID(item["source_node_id"]) and edge.target_id == UUID(item["target_node_id"]):
                edge_ids.add(edge.id)
                edges.append(edge)
    return ReliabilityGraphOverviewRead(
        nodes=[_graph_node_item(node) for node in graph_nodes],
        edges=[_graph_edge_item(edge) for edge in edges],
    )


@router.get("/intelligence/node/{node_id}", response_model=ReliabilityGraphNodeDetailRead)
def get_reliability_graph_node_endpoint(
    node_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityGraphNodeDetailRead:
    node, related = get_related_nodes(db, node_id=node_id, organization_ids=operator.organization_ids)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Graph node not found")
    return ReliabilityGraphNodeDetailRead(
        node=_graph_node_item(node),
        related=[
            ReliabilityGraphRelatedNodeRead(
                node=_graph_node_item(related_node),
                edge=_graph_edge_item(edge),
            )
            for related_node, edge in related
        ],
    )


@router.get("/intelligence/high-risk-patterns", response_model=ReliabilityGraphPatternListResponse)
def list_graph_high_risk_patterns_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityGraphPatternListResponse:
    return ReliabilityGraphPatternListResponse(
        items=[
            _graph_pattern_item(item)
            for item in get_high_risk_patterns(db, organization_ids=operator.organization_ids, limit=25)
        ]
    )


@router.get("/intelligence/guardrail-recommendations", response_model=GraphGuardrailRecommendationListResponse)
def list_graph_guardrail_recommendations_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> GraphGuardrailRecommendationListResponse:
    return GraphGuardrailRecommendationListResponse(
        items=[
            GraphGuardrailRecommendationRead.model_validate(item)
            for item in get_graph_guardrail_recommendations(db, organization_ids=operator.organization_ids)
        ]
    )


@router.get("/intelligence/patterns", response_model=ReliabilityPatternListResponse)
def list_reliability_patterns_endpoint(
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityPatternListResponse:
    del operator
    return ReliabilityPatternListResponse(
        items=[_reliability_pattern_item(item) for item in list_reliability_patterns(db)]
    )


@router.get("/intelligence/patterns/{pattern_id}", response_model=ReliabilityPatternRead)
def get_reliability_pattern_endpoint(
    pattern_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityPatternRead:
    del operator
    item = get_reliability_pattern(db, pattern_id=pattern_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reliability pattern not found")
    return _reliability_pattern_item(item)


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization_endpoint(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationRead:
    if payload.owner_auth_user_id != str(operator.operator.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return create_organization(db, payload)


@router.post("/billing/checkout", response_model=BillingCheckoutResponse)
def billing_checkout_endpoint(
    payload: BillingCheckoutRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> BillingCheckoutResponse:
    organization = get_organization(db, payload.organization_id)
    require_org_role(operator, payload.organization_id, "admin")
    ensure_stripe_customer(db, organization)
    settings = get_settings()
    checkout_url = create_checkout_session(
        organization,
        payload.plan.strip().lower(),
        success_url=f"{settings.app_url}/billing/success",
        cancel_url=f"{settings.app_url}/settings/billing",
    )
    return BillingCheckoutResponse(checkout_url=checkout_url)


@router.post("/billing/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def billing_webhook_endpoint(
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    handle_stripe_webhook(db, payload, signature)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/config/apply", response_model=ConfigApplyResponse)
def apply_config_endpoint(
    payload: ConfigApplyRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ConfigApplyResponse:
    organization_id = operator.active_organization_id
    if organization_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active organization selected")
    require_org_role(operator, organization_id, "admin")
    snapshot = apply_config_patch(
        db,
        operator=operator,
        organization_id=organization_id,
        patch=payload.patch,
        source_trace_id=payload.source_trace_id,
        reason=payload.reason,
    )
    if payload.incident_id is not None:
        action_time = datetime.now(timezone.utc)
        incident = get_incident_detail(db, operator, payload.incident_id)
        resolution_impact = build_resolution_impact_baseline(
            db,
            incident=incident,
            action_time=action_time,
        )
        metadata_json = {
            "config_snapshot_id": str(snapshot.id),
            "source_trace_id": payload.source_trace_id,
            "patch": [item.model_dump(by_alias=True) for item in payload.patch],
            "reason": payload.reason,
        }
        if resolution_impact is not None:
            metadata_json["resolution_impact"] = resolution_impact
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_CONFIG_APPLIED,
            actor_operator_user_id=operator.operator.id,
            metadata_json=metadata_json,
            created_at=action_time,
        )
        db.commit()
    return ConfigApplyResponse(
        status="applied",
        config_snapshot=ConfigSnapshotRead.model_validate(snapshot),
    )


@router.post("/config/undo", response_model=ConfigApplyResponse)
def undo_config_endpoint(
    payload: ConfigUndoRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ConfigApplyResponse:
    organization_id = operator.active_organization_id
    if organization_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active organization selected")
    require_org_role(operator, organization_id, "admin")
    snapshot = undo_config_patch(
        db,
        operator=operator,
        organization_id=organization_id,
        source_trace_id=payload.source_trace_id,
        reason=payload.reason,
    )
    if payload.incident_id is not None:
        action_time = datetime.now(timezone.utc)
        incident = get_incident_detail(db, operator, payload.incident_id)
        resolution_impact = build_resolution_impact_baseline(
            db,
            incident=incident,
            action_time=action_time,
        )
        metadata_json = {
            "config_snapshot_id": str(snapshot.id),
            "source_trace_id": payload.source_trace_id,
            "reason": payload.reason,
        }
        if resolution_impact is not None:
            metadata_json["resolution_impact"] = resolution_impact
        append_incident_event(
            db,
            incident=incident,
            event_type=INCIDENT_EVENT_CONFIG_UNDONE,
            actor_operator_user_id=operator.operator.id,
            metadata_json=metadata_json,
            created_at=action_time,
        )
        db.commit()
    return ConfigApplyResponse(
        status="undone",
        config_snapshot=ConfigSnapshotRead.model_validate(snapshot),
    )


@router.post("/auth/sign-in", response_model=AuthSessionResponse)
def sign_in_operator_endpoint(
    payload: AuthSignInRequest, db: Session = Depends(get_db)
) -> AuthSessionResponse:
    operator, session, session_token = sign_in_operator(db, payload)
    return AuthSessionResponse(
        session_token=session_token,
        operator=OperatorRead(
            id=operator.id,
            email=operator.email,
            is_system_admin=operator.is_system_admin,
        ),
        memberships=_membership_items(db, get_operator_memberships(db, operator.id)),
        active_organization_id=operator.active_organization_id,
        expires_at=session.expires_at,
    )


@router.get("/auth/session", response_model=AuthSessionResponse)
def auth_session_endpoint(
    operator: OperatorContext = Depends(require_operator),
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    return AuthSessionResponse(
        operator=OperatorRead(
            id=operator.operator.id,
            email=operator.operator.email,
            is_system_admin=operator.operator.is_system_admin,
        ),
        memberships=_membership_items(db, operator.memberships),
        active_organization_id=operator.active_organization_id,
        expires_at=operator.expires_at,
    )


@router.post("/auth/switch-organization", response_model=AuthSessionResponse)
def switch_organization_endpoint(
    payload: AuthSwitchOrganizationRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> AuthSessionResponse:
    user = set_active_organization(
        db,
        user=operator.operator,
        organization_id=payload.organization_id,
    )
    memberships = get_operator_memberships(db, user.id)
    return AuthSessionResponse(
        operator=OperatorRead(
            id=user.id,
            email=user.email,
            is_system_admin=user.is_system_admin,
        ),
        memberships=_membership_items(db, memberships),
        active_organization_id=user.active_organization_id,
        expires_at=operator.expires_at,
        session_token=operator.session_token,
    )


@router.post("/auth/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out_operator_endpoint(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    token = authorization[7:]
    if token.count(".") != 2:
        revoke_session(db, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/auth/workos/scim", status_code=status.HTTP_204_NO_CONTENT)
def handle_workos_scim_event_endpoint(
    payload: dict,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    secret = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else payload.get("secret")
    if secret != get_settings().workos_scim_webhook_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid SCIM secret")
    event_type = str(payload.get("event_type") or "")
    if event_type == "user_provisioned":
        handle_scim_user_provisioned(
            db,
            email=str(payload["email"]),
            workos_user_id=str(payload["workos_user_id"]),
            groups=list(payload.get("groups") or []),
            organization_ids=list(payload.get("organization_ids") or []),
        )
    elif event_type == "user_deprovisioned":
        handle_scim_user_deprovisioned(db, workos_user_id=str(payload["workos_user_id"]))
    elif event_type == "group_updated":
        handle_scim_group_updated(
            db,
            workos_user_id=str(payload["workos_user_id"]),
            groups=list(payload.get("groups") or []),
            organization_ids=list(payload.get("organization_ids") or []),
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported SCIM event")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/api-keys", response_model=PublicAPIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_public_api_key_endpoint(
    payload: PublicAPIKeyCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PublicAPIKeyCreateResponse:
    require_org_role(operator, payload.organization_id, "org_admin")
    record, plaintext = create_public_api_key(
        db,
        organization_id=payload.organization_id,
        name=payload.name,
        actor_user_id=operator.operator.id,
    )
    return PublicAPIKeyCreateResponse(api_key=plaintext, api_key_record=_public_api_key_item(record))


@router.get("/api-keys", response_model=PublicAPIKeyListResponse)
def list_public_api_keys_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PublicAPIKeyListResponse:
    require_org_role(operator, organization_id, "viewer")
    return PublicAPIKeyListResponse(
        items=[_public_api_key_item(item) for item in list_public_api_keys(db, organization_id=organization_id)]
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_public_api_key_endpoint(
    key_id: UUID,
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> Response:
    require_org_role(operator, organization_id, "org_admin")
    revoke_public_api_key(
        db,
        organization_id=organization_id,
        key_id=key_id,
        actor_user_id=operator.operator.id,
    )
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
    "/organizations/{organization_id}/policies",
    response_model=OrganizationGuardrailPolicyListResponse,
)
def list_organization_guardrail_policies_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> OrganizationGuardrailPolicyListResponse:
    if x_api_key:
        api_key = authenticate_api_key(db, x_api_key)
        if api_key is None:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        require_api_key_organization_access(db, api_key=api_key, organization_id=organization_id)
    elif authorization and authorization.lower().startswith("bearer "):
        operator = get_operator_context(db, authorization[7:])
        require_organization_membership(operator, organization_id)
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    items = list_active_organization_guardrail_policies(db, organization_id=organization_id)
    return OrganizationGuardrailPolicyListResponse(
        items=[_organization_guardrail_policy_item(item) for item in items]
    )


@router.get("/organizations/{organization_id}/members", response_model=OrganizationMemberListResponse)
def list_organization_members_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationMemberListResponse:
    require_org_role(operator, organization_id, "admin")
    items = list_organization_members(db, organization_id=organization_id)
    return OrganizationMemberListResponse(
        items=[
            OrganizationMemberRead(
                user_id=item.user_id,
                organization_id=item.organization_id,
                role=item.role,
                email=item.user.email if getattr(item, "user", None) is not None else None,
                created_at=item.created_at,
            )
            for item in items
        ]
    )


@router.post("/organizations/{organization_id}/members", response_model=OrganizationMemberRead, status_code=status.HTTP_201_CREATED)
def add_organization_member_endpoint(
    organization_id: UUID,
    payload: OrganizationMemberCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationMemberRead:
    require_org_role(operator, organization_id, "admin")
    organization = get_organization(db, organization_id)
    if not has_feature(organization.plan, "collaboration"):
        prompt = get_upgrade_prompt("team_invite")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=UpgradeRequiredResponse(upgrade_prompt=prompt).model_dump(),
        )
    normalized_role = normalize_org_role(payload.role)
    if normalized_role == "viewer" and not has_feature(organization.plan, "dashboards"):
        prompt = get_upgrade_prompt("dashboard_share")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=UpgradeRequiredResponse(upgrade_prompt=prompt).model_dump(),
        )
    item = add_organization_member(
        db,
        organization_id=organization_id,
        user_id=payload.user_id,
        role=normalized_role,
        actor_user_id=operator.operator.id,
    )
    return OrganizationMemberRead(
        user_id=item.user_id,
        organization_id=item.organization_id,
        role=item.role,
        email=item.user.email if getattr(item, "user", None) is not None else None,
        created_at=item.created_at,
    )


@router.delete("/organizations/{organization_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_organization_member_endpoint(
    organization_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> Response:
    require_org_role(operator, organization_id, "admin")
    organization = get_organization(db, organization_id)
    if not has_feature(organization.plan, "collaboration"):
        prompt = get_upgrade_prompt("team_invite")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=UpgradeRequiredResponse(upgrade_prompt=prompt).model_dump(),
        )
    remove_organization_member(
        db,
        organization_id=organization_id,
        user_id=user_id,
        actor_user_id=operator.operator.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    require_org_role(operator, organization_id, "org_admin")
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
    require_org_role(operator, organization_id, "org_admin")
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
    require_org_role(operator, organization_id, "org_admin")
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
    require_org_role(operator, organization_id, "org_admin")
    success, detail = test_org_alert_target(db, organization_id)
    return OrganizationAlertTargetTestResponse(
        success=success,
        detail=detail,
        tested_at=datetime.now(timezone.utc),
    )


@router.get("/organizations/{organization_id}/usage-quota", response_model=UsageQuotaStatusRead)
def get_org_usage_quota_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> UsageQuotaStatusRead:
    require_org_role(operator, organization_id, "viewer")
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    usage_status = get_usage_status(db, organization_id=organization_id)
    upgrade_prompt = None
    percent_used = float(usage_status.get("usage_percent") or usage_status.get("percent_used") or 0)
    projected_usage = int(usage_status.get("projected_usage") or 0)
    limit = usage_status.get("limit")
    if percent_used >= 0.8 or (limit and projected_usage > int(limit)):
        prompt_key = "usage_blocked" if percent_used >= 1.0 else "usage_warning"
        upgrade_prompt = get_upgrade_prompt(prompt_key, usage_status)
    return UsageQuotaStatusRead(
        **UsageQuotaRead.model_validate(quota).model_dump(),
        usage_status=usage_status,
        upgrade_prompt=upgrade_prompt,
    )


@router.put("/organizations/{organization_id}/usage-quota", response_model=UsageQuotaRead)
def upsert_org_usage_quota_endpoint(
    organization_id: UUID,
    payload: UsageQuotaUpsert,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> UsageQuotaRead:
    require_org_role(operator, organization_id, "org_admin")
    quota = get_or_create_usage_quota(db, organization_id=organization_id)
    quota.max_traces_per_day = payload.max_traces_per_day
    quota.max_processors = payload.max_processors
    quota.max_api_requests = payload.max_api_requests
    db.add(quota)
    db.commit()
    db.refresh(quota)
    return UsageQuotaRead.model_validate(quota)


@router.get("/organizations/{organization_id}/extensions", response_model=PlatformExtensionListResponse)
def list_platform_extensions_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PlatformExtensionListResponse:
    require_org_role(operator, organization_id, "viewer")
    return PlatformExtensionListResponse(
        items=[_platform_extension_item(db, item) for item in list_platform_extensions(db, organization_id=organization_id)]
    )


@router.post(
    "/organizations/{organization_id}/extensions",
    response_model=PlatformExtensionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_platform_extension_endpoint(
    organization_id: UUID,
    payload: PlatformExtensionCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PlatformExtensionRead:
    require_org_role(operator, organization_id, "org_admin")
    if payload.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization mismatch")
    extension = create_platform_extension(db, payload=payload, actor_user_id=operator.operator.id)
    return _platform_extension_item(db, extension)


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
    require_org_role(operator, organization_id, "org_admin")
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


@router.get("/projects/{project_id}/members", response_model=ProjectMemberListResponse)
def list_project_members_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectMemberListResponse:
    project = require_project_access(db, operator, project_id)
    require_org_role(operator, project.organization_id, "org_admin")
    items = list_project_members(db, project_id=project_id)
    return ProjectMemberListResponse(
        items=[
            ProjectMemberRead(
                user_id=item.user_id,
                project_id=item.project_id,
                role=item.role,
                email=item.user.email if getattr(item, "user", None) is not None else None,
                created_at=item.created_at,
            )
            for item in items
        ]
    )


@router.post("/projects/{project_id}/members", response_model=ProjectMemberRead, status_code=status.HTTP_201_CREATED)
def add_project_member_endpoint(
    project_id: UUID,
    payload: ProjectMemberCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectMemberRead:
    project = require_project_access(db, operator, project_id)
    require_org_role(operator, project.organization_id, "org_admin")
    item = add_project_member(
        db,
        project_id=project_id,
        user_id=payload.user_id,
        role=payload.role,
        actor_user_id=operator.operator.id,
    )
    return ProjectMemberRead(
        user_id=item.user_id,
        project_id=item.project_id,
        role=item.role,
        email=item.user.email if getattr(item, "user", None) is not None else None,
        created_at=item.created_at,
    )


@router.delete("/projects/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member_endpoint(
    project_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> Response:
    project = require_project_access(db, operator, project_id)
    require_org_role(operator, project.organization_id, "org_admin")
    remove_project_member(
        db,
        project_id=project_id,
        user_id=user_id,
        actor_user_id=operator.operator.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/projects/{project_id}/environments", response_model=EnvironmentListResponse)
def list_project_environments_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> EnvironmentListResponse:
    require_project_access(db, operator, project_id)
    items = list_project_environments(db, project_id=project_id)
    return EnvironmentListResponse(items=[EnvironmentRead.model_validate(item) for item in items])


@router.post(
    "/projects/{project_id}/environments",
    response_model=EnvironmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_environment_endpoint(
    project_id: UUID,
    payload: EnvironmentCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> EnvironmentRead:
    project = require_project_role(db, operator, project_id, "engineer")
    environment = create_environment(
        db,
        project=project,
        name=payload.name,
        environment_type=payload.type,
        actor_user_id=operator.operator.id,
    )
    return EnvironmentRead.model_validate(environment)


@router.get("/projects/{project_id}/processors", response_model=ExternalProcessorListResponse)
def list_project_processors_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ExternalProcessorListResponse:
    require_project_access(db, operator, project_id)
    items = list_project_external_processors(db, project_id=project_id)
    return ExternalProcessorListResponse(
        items=[ExternalProcessorRead.model_validate(processor_read_model(db, item)) for item in items]
    )


@router.post(
    "/projects/{project_id}/processors",
    response_model=ExternalProcessorRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_processor_endpoint(
    project_id: UUID,
    payload: ExternalProcessorCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ExternalProcessorRead:
    project = require_project_role(db, operator, project_id, "engineer")
    processor = create_external_processor(
        db,
        project=project,
        payload=payload,
        actor_user_id=operator.operator.id,
    )
    return ExternalProcessorRead.model_validate(processor_read_model(db, processor))


@router.patch("/projects/{project_id}/processors/{processor_id}", response_model=ExternalProcessorRead)
def update_project_processor_endpoint(
    project_id: UUID,
    processor_id: UUID,
    payload: ExternalProcessorUpdate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ExternalProcessorRead:
    project = require_project_role(db, operator, project_id, "engineer")
    processor = update_external_processor(
        db,
        project=project,
        processor_id=processor_id,
        payload=payload,
        actor_user_id=operator.operator.id,
    )
    return ExternalProcessorRead.model_validate(processor_read_model(db, processor))


@router.get("/projects/{project_id}/ingestion-policy", response_model=TraceIngestionPolicyRead)
def get_project_ingestion_policy_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceIngestionPolicyRead:
    project = require_project_access(db, operator, project_id)
    return _trace_ingestion_policy_item(db, project)


@router.put("/projects/{project_id}/ingestion-policy", response_model=TraceIngestionPolicyRead)
def update_project_ingestion_policy_endpoint(
    project_id: UUID,
    payload: TraceIngestionPolicyUpdate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceIngestionPolicyRead:
    project = require_project_role(db, operator, project_id, "engineer")
    upsert_project_ingestion_policy(db, project=project, payload=payload)
    return _trace_ingestion_policy_item(db, project)


@router.get("/projects/{project_id}/custom-metrics", response_model=ProjectCustomMetricListResponse)
def list_project_custom_metrics_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectCustomMetricListResponse:
    require_project_access(db, operator, project_id)
    items = list_project_custom_metrics(db, project_id=project_id)
    return ProjectCustomMetricListResponse(items=[ProjectCustomMetricRead.model_validate(item) for item in items])


@router.post(
    "/projects/{project_id}/custom-metrics",
    response_model=ProjectCustomMetricRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_custom_metric_endpoint(
    project_id: UUID,
    payload: ProjectCustomMetricCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectCustomMetricRead:
    project = require_project_role(db, operator, project_id, "engineer")
    item = create_project_custom_metric(db, project=project, payload=payload)
    return ProjectCustomMetricRead.model_validate(item)


@router.patch(
    "/projects/{project_id}/custom-metrics/{metric_id}",
    response_model=ProjectCustomMetricRead,
)
def update_project_custom_metric_endpoint(
    project_id: UUID,
    metric_id: UUID,
    payload: ProjectCustomMetricUpdate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectCustomMetricRead:
    require_project_role(db, operator, project_id, "engineer")
    item = set_project_custom_metric_enabled(
        db,
        project_id=project_id,
        metric_id=metric_id,
        enabled=payload.enabled,
    )
    return ProjectCustomMetricRead.model_validate(item)


@router.get("/projects/{project_id}/guardrails", response_model=GuardrailPolicyListResponse)
def list_project_guardrails_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> GuardrailPolicyListResponse:
    require_project_access(db, operator, project_id)
    if environment is not None:
        require_environment_access(db, operator, project_id, environment)
    items = list_guardrail_policies(db, project_id=project_id, environment=environment)
    return GuardrailPolicyListResponse(items=[GuardrailPolicyRead.model_validate(item) for item in items])


@router.post(
    "/projects/{project_id}/guardrails",
    response_model=GuardrailPolicyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_guardrail_endpoint(
    project_id: UUID,
    payload: GuardrailPolicyCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> GuardrailPolicyRead:
    project = require_project_role(db, operator, project_id, "engineer")
    policy = create_guardrail_policy(
        db,
        project=project,
        payload=payload,
        actor_user_id=operator.operator.id,
    )
    return GuardrailPolicyRead.model_validate(policy)


@router.get("/projects/{project_id}/guardrail-metrics", response_model=GuardrailMetricsRead)
def get_project_guardrail_metrics_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> GuardrailMetricsRead:
    project = _project_from_session_or_api_key(
        db=db,
        project_id=project_id,
        x_api_key=x_api_key,
        authorization=authorization,
    )
    if environment is not None:
        resolve_project_environment(db, project=project, name=environment)
    return GuardrailMetricsRead(
        policies=[_guardrail_policy_metrics_item(item) for item in get_guardrail_policy_metrics(db, project_id, environment)],
        recent_events=[
            _guardrail_runtime_event_summary_item(item)
            for item in get_recent_guardrail_events(db, project_id, environment=environment)
        ],
        trace_policy_counts=[
            _guardrail_trace_policy_count_item(item)
            for item in get_trace_guardrail_policy_counts(db, project_id, environment=environment)
        ],
    )


@router.post(
    "/projects/{project_id}/deployments",
    response_model=DeploymentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_deployment_endpoint(
    project_id: UUID,
    payload: DeploymentCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DeploymentRead:
    require_project_role(db, operator, project_id, "engineer")
    deployment = create_deployment(
        db,
        project_id=project_id,
        payload=payload,
        actor_user_id=operator.operator.id,
    )
    return _deployment_item(deployment)


@router.get("/projects/{project_id}/deployments", response_model=DeploymentListResponse)
def list_project_deployments_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DeploymentListResponse:
    require_project_access(db, operator, project_id)
    if environment is not None:
        require_environment_access(db, operator, project_id, environment)
    deployments = list_project_deployments(db, project_id=project_id, environment=environment)
    return DeploymentListResponse(items=[_deployment_item(item) for item in deployments])


@router.post(
    "/projects/{project_id}/deployments/simulate",
    response_model=DeploymentSimulationRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_deployment_simulation_endpoint(
    project_id: UUID,
    payload: DeploymentSimulationCreate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> DeploymentSimulationRead:
    project = _project_from_session_or_api_key(
        db=db,
        project_id=project_id,
        x_api_key=x_api_key,
        authorization=authorization,
    )
    if not x_api_key:
        operator = get_operator_context(db, authorization[7:]) if authorization and authorization.lower().startswith("bearer ") else None
        if operator is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        project = require_project_role(db, operator, project_id, "engineer")
    simulation = create_deployment_simulation(
        db,
        organization_id=project.organization_id,
        project_id=project.id,
        environment_name=payload.environment,
        prompt_version_id=payload.prompt_version_id,
        model_version_id=payload.model_version_id,
        sample_size=payload.sample_size,
    )
    enqueue_deployment_simulation(simulation_id=simulation.id)
    return _deployment_simulation_item(simulation)


@router.get("/deployments/{deployment_id}", response_model=DeploymentDetailRead)
def get_deployment_detail_endpoint(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DeploymentDetailRead:
    deployment = get_deployment_detail(db, operator=operator, deployment_id=deployment_id)
    intelligence = get_deployment_intelligence(db, operator=operator, deployment_id=deployment_id)
    gate = get_deployment_gate_result(db, operator=operator, deployment_id=deployment_id)
    return DeploymentDetailRead(
        **_deployment_item(deployment).model_dump(),
        prompt_version=PromptVersionRead.model_validate(deployment.prompt_version)
        if deployment.prompt_version is not None
        else None,
        model_version=ModelVersionRead.model_validate(deployment.model_version)
        if deployment.model_version is not None
        else None,
        events=[_deployment_event_item(event) for event in deployment.events],
        rollbacks=[_deployment_rollback_item(item) for item in deployment.rollbacks],
        incident_ids=[incident.id for incident in deployment.incidents],
        latest_risk_score=_deployment_risk_item(deployment.risk_score)
        if deployment.risk_score is not None
        else None,
        intelligence=_deployment_intelligence_item(intelligence),
        gate=_deployment_gate_item(gate),
    )


@router.get("/deployments/{deployment_id}/risk", response_model=DeploymentRiskRead)
def get_deployment_risk_endpoint(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DeploymentRiskRead:
    deployment = get_deployment_detail(db, operator=operator, deployment_id=deployment_id)
    risk_score = calculate_deployment_risk(db, deployment_id=deployment.id)
    db.commit()
    return _deployment_risk_item(risk_score)


@router.get("/deployments/{deployment_id}/gate", response_model=DeploymentGateRead)
def get_deployment_gate_endpoint(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> DeploymentGateRead:
    gate = get_deployment_gate_result(db, operator=operator, deployment_id=deployment_id)
    return _deployment_gate_item(gate)


@router.get("/projects/{project_id}/reliability", response_model=ProjectReliabilityRead)
def get_project_reliability_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectReliabilityRead:
    project = require_project_access(db, operator, project_id)
    if environment is not None:
        require_environment_access(db, operator, project_id, environment)
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
        IncidentListQuery(project_id=project_id, environment=environment, limit=5),
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


@router.get("/projects/{project_id}/timeline", response_model=TimelineResponse)
def get_project_timeline_endpoint(
    project_id: UUID,
    limit: int = 100,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TimelineResponse:
    require_project_access(db, operator, project_id)
    if environment is not None:
        require_environment_access(db, operator, project_id, environment)
    items = get_project_timeline(db, project_id=project_id, limit=max(1, min(limit, 200)), environment=environment)
    return TimelineResponse(items=[TimelineEventRead.model_validate(item) for item in items])


@router.get(
    "/projects/{project_id}/control-panel",
    response_model=ProjectReliabilityControlPanelRead,
)
def get_project_reliability_control_panel_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectReliabilityControlPanelRead:
    require_project_access(db, operator, project_id)
    if environment is not None:
        require_environment_access(db, operator, project_id, environment)
    return ProjectReliabilityControlPanelRead.model_validate(
        get_project_reliability_control_panel(db, project_id, environment)
    )


@router.get("/projects/{project_id}/cost", response_model=ProjectCostRead)
def get_project_cost_endpoint(
    project_id: UUID,
    environment: str | None = None,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectCostRead:
    project = require_project_access(db, operator, project_id)
    environment_ref = (
        require_environment_access(db, operator, project_id, environment) if environment is not None else None
    )
    result = get_project_cost_intelligence(
        organization_id=project.organization_id,
        project_id=project.id,
        environment_id=environment_ref.id if environment_ref is not None else None,
    )
    return ProjectCostRead(
        cost_per_trace=result["cost_per_trace"],
        daily_cost=[DailyCostPointRead.model_validate(item) for item in result["daily_cost"]],
        cost_per_model=[CostByModelRead.model_validate(item) for item in result["cost_per_model"]],
        cost_anomalies=[CostAnomalyRead.model_validate(item) for item in result["cost_anomalies"]],
    )


@router.post(
    "/projects/{project_id}/export",
    response_model=CustomerExportRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_project_export_endpoint(
    project_id: UUID,
    payload: CustomerExportCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> CustomerExportRead:
    require_project_access(db, operator, project_id)
    export = create_customer_export(
        db,
        project_id=project_id,
        export_format=payload.export_format,
        actor_user_id=operator.operator.id,
    )
    return CustomerExportRead.model_validate(export)


@router.get("/exports/{export_id}", response_model=CustomerExportRead)
def get_export_endpoint(
    export_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> CustomerExportRead:
    export = get_customer_export(db, export_id=export_id)
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found")
    require_org_role(operator, export.organization_id, "viewer")
    return CustomerExportRead.model_validate(export)


@router.get(
    "/projects/{project_id}/automation-actions",
    response_model=ReliabilityActionLogListResponse,
)
def list_project_automation_actions_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ReliabilityActionLogListResponse:
    require_project_access(db, operator, project_id)
    return ReliabilityActionLogListResponse(
        items=[
            _reliability_action_log_item(item)
            for item in list_project_reliability_actions(db, project_id=project_id)
        ]
    )


@router.get(
    "/projects/{project_id}/recommendations",
    response_model=list[ReliabilityRecommendationRead],
)
def get_project_recommendations_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> list[ReliabilityRecommendationRead]:
    require_project_access(db, operator, project_id)
    items = get_active_recommendations(db, project_id)
    if not items:
        items = generate_recommendations(db, project_id)
        db.commit()
    return [_reliability_recommendation_item(item) for item in items]


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


@router.get("/prompts/diff", response_model=PromptDiffRead)
def get_prompt_diff_endpoint(
    from_version_id: UUID = Query(alias="fromVersionId"),
    to_version_id: UUID = Query(alias="toVersionId"),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> PromptDiffRead:
    result = get_prompt_version_diff(
        db,
        operator,
        from_version_id=from_version_id,
        to_version_id=to_version_id,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt versions not found")
    return PromptDiffRead.model_validate(result)


@router.post("/onboarding/simulations", response_model=OnboardingSimulationCreateResponse)
def create_onboarding_simulation_endpoint(
    payload: OnboardingSimulationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OnboardingSimulationCreateResponse:
    try:
        simulation = create_onboarding_simulation(
            db,
            operator,
            project_name=payload.project_name,
            model_name=payload.model_name,
            prompt_type=payload.prompt_type,
            simulation_type=payload.simulation_type or "refusal_spike",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    background_tasks.add_task(run_onboarding_simulation, simulation.id)
    return OnboardingSimulationCreateResponse(simulation_id=simulation.id)


@router.get("/onboarding/simulations/{simulation_id}/status", response_model=OnboardingSimulationStatusRead)
def get_onboarding_simulation_status_endpoint(
    simulation_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OnboardingSimulationStatusRead:
    simulation = get_onboarding_simulation(
        db,
        operator,
        simulation_id=simulation_id,
    )
    if simulation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found")
    payload = simulation.analysis_json or {}
    incident_id = payload.get("incident_id")

    raw_status = str(payload.get("status") or "pending")
    status_value = raw_status if raw_status in {"pending", "running", "complete", "failed"} else "failed"
    try:
        progress_value = int(payload.get("progress") or 0)
    except (TypeError, ValueError):
        progress_value = 0
    progress_value = max(0, min(progress_value, 100))

    raw_stage = payload.get("stage")
    stage_value = str(raw_stage).strip() if raw_stage else "queued"

    incident_uuid = None
    if isinstance(incident_id, str):
        try:
            incident_uuid = UUID(incident_id)
        except ValueError:
            incident_uuid = None

    return OnboardingSimulationStatusRead(
        simulation_id=simulation.id,
        status=status_value,
        progress=progress_value,
        stage=stage_value,
        incident_id=incident_uuid,
        error=str(payload.get("error")) if payload.get("error") else None,
        created_at=simulation.created_at,
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


@router.get("/projects/{project_id}/incidents", response_model=IncidentListResponse)
def list_project_incidents_endpoint(
    project_id: UUID,
    query: IncidentListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentListResponse:
    require_project_access(db, operator, project_id)
    incidents = list_incidents(
        db,
        operator,
        query.model_copy(update={"project_id": project_id}),
    )
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
    return _incident_detail_item(
        db,
        incident,
        regressions,
        traces,
        events,
        representative_traces,
        baseline_traces,
    )


@router.get("/incidents/{incident_id}/command", response_model=IncidentCommandCenterRead)
def get_incident_command_center_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentCommandCenterRead:
    command = get_incident_command_center(db, operator, incident_id)
    return IncidentCommandCenterRead(
        incident=_incident_detail_item(
            db,
            command.incident,
            command.regressions,
            command.traces,
            command.events,
            command.representative_traces,
            command.baseline_traces,
        ),
        root_cause=_incident_command_root_cause_item(command.root_cause_report),
        metric=_incident_command_metric_item(command.incident),
        trace_compare=IncidentCommandTraceCompareRead(
            failing_trace_summary=_trace_compare_item(command.trace_compare.trace)
            if command.trace_compare is not None
            else None,
            baseline_trace_summary=_trace_compare_item(command.trace_compare.baseline_trace)
            if command.trace_compare is not None and command.trace_compare.baseline_trace is not None
            else None,
            compare_link=command.compare_link,
        ),
        deployment_context=_incident_deployment_context_item(command.incident),
        guardrail_activity=[_guardrail_activity_item(item) for item in command.guardrail_activity],
        possible_root_causes=list(command.possible_root_causes),
        graph_related_patterns=list(command.graph_related_patterns),
        similar_platform_failures=list(command.similar_platform_failures),
        recommended_mitigations=list(command.recommended_mitigations),
        related_regressions=[
            RegressionSnapshotRead.model_validate(regression)
            for regression in command.related_regressions
        ],
        recent_signals=list(command.recent_signals),
    )


@router.get("/incidents/{incident_id}/investigation", response_model=IncidentInvestigationRead)
def get_incident_investigation_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentInvestigationRead:
    investigation = get_incident_investigation(db, operator, incident_id)
    command = investigation.command_center
    return IncidentInvestigationRead(
        incident=_incident_detail_item(
            db,
            command.incident,
            command.regressions,
            command.traces,
            command.events,
            command.representative_traces,
            command.baseline_traces,
        ),
        root_cause_analysis=_incident_investigation_root_cause_item(command.root_cause_report),
        deployment_context=InvestigationDeploymentContextRead(
            deployment=_incident_deployment_context_item(command.incident),
            latest_risk_score=_deployment_risk_item(command.incident.deployment.risk_score)
            if command.incident.deployment is not None and command.incident.deployment.risk_score is not None
            else None,
            latest_simulation=_deployment_simulation_item(investigation.latest_simulation)
            if investigation.latest_simulation is not None
            else None,
            deployment_link=(
                f"/deployments/{command.incident.deployment.id}"
                if command.incident.deployment is not None
                else None
            ),
        ),
        trace_comparison=IncidentInvestigationTraceComparisonRead(
            compare_link=command.compare_link,
            failing_trace_summary=TraceCompareItemRead.model_validate(
                investigation.comparison["failing_trace"]
            )
            if investigation.comparison["failing_trace"] is not None
            else None,
            baseline_trace_summary=TraceCompareItemRead.model_validate(
                investigation.comparison["baseline_trace"]
            )
            if investigation.comparison["baseline_trace"] is not None
            else None,
            comparison=investigation.comparison,
            key_differences=[
                InvestigationKeyDifferenceRead.model_validate(item)
                for item in investigation.key_differences
            ],
        ),
        recommendations=[
            _investigation_recommendation_item(item) for item in investigation.recommendations
        ],
        guardrail_activity=[_guardrail_activity_item(item) for item in command.guardrail_activity],
        possible_root_causes=list(command.possible_root_causes),
    )


@router.get("/incidents/{incident_id}/graph", response_model=IncidentGraphRead)
def get_incident_graph_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentGraphRead:
    graph = get_incident_graph(db, operator, incident_id)
    return IncidentGraphRead(
        incident=_incident_list_item(graph["incident"]),
        regressions=[RegressionSnapshotRead.model_validate(item) for item in graph["regressions"]],
        traces=[_graph_trace_item(item) for item in graph["traces"]],
        prompt_version=PromptVersionRead.model_validate(graph["prompt_version"])
        if graph["prompt_version"] is not None
        else None,
        model_version=ModelVersionRead.model_validate(graph["model_version"])
        if graph["model_version"] is not None
        else None,
        deployment=graph["deployment"],
        evaluations=[_graph_trace_evaluation_item(item) for item in graph["evaluations"]],
        root_causes=[GraphIncidentRootCauseRead.model_validate(item) for item in graph["root_causes"]],
    )


@router.post("/incidents/{incident_id}/acknowledge", response_model=IncidentDetailRead)
def acknowledge_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = get_incident_detail(db, operator, incident_id)
    require_project_role(db, operator, incident.project_id, "engineer")
    incident = acknowledge_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    return _incident_detail_item(
        db,
        incident,
        regressions,
        traces,
        events,
        representative_traces,
        baseline_traces,
    )


@router.post("/incidents/{incident_id}/owner", response_model=IncidentDetailRead)
def assign_incident_owner_endpoint(
    incident_id: UUID,
    payload: IncidentOwnerAssignRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = get_incident_detail(db, operator, incident_id)
    require_project_role(db, operator, incident.project_id, "engineer")
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
    return _incident_detail_item(
        db,
        incident,
        regressions,
        traces,
        events,
        representative_traces,
        baseline_traces,
    )


@router.post("/incidents/{incident_id}/resolve", response_model=IncidentDetailRead)
def resolve_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = get_incident_detail(db, operator, incident_id)
    require_project_role(db, operator, incident.project_id, "engineer")
    incident = resolve_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    return _incident_detail_item(
        db,
        incident,
        regressions,
        traces,
        events,
        representative_traces,
        baseline_traces,
    )


@router.post("/incidents/{incident_id}/reopen", response_model=IncidentDetailRead)
def reopen_incident_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentDetailRead:
    incident = get_incident_detail(db, operator, incident_id)
    require_project_role(db, operator, incident.project_id, "engineer")
    incident = reopen_incident(db, operator, incident_id)
    regressions = get_incident_regressions(db, incident)
    traces = get_incident_traces(db, incident)
    representative_traces, baseline_traces = get_incident_compare_traces(db, incident)
    events = get_incident_events(db, operator, incident_id)
    return _incident_detail_item(
        db,
        incident,
        regressions,
        traces,
        events,
        representative_traces,
        baseline_traces,
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
    prompt_version_contexts, model_version_contexts = derive_incident_registry_contexts(
        db,
        incident=incident,
        current_traces=current_traces,
        baseline_traces=baseline_traces,
    )
    prompt_content_diff = compute_prompt_content_diff(
        db,
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
        prompt_content_diff=prompt_content_diff,
    )


@router.get("/incidents/{incident_id}/analysis", response_model=IncidentAnalysisResponse)
def get_incident_analysis_endpoint(
    incident_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> IncidentAnalysisResponse:
    report = get_incident_analysis(db, operator, incident_id=incident_id)
    return IncidentAnalysisResponse(incident=_incident_analysis_item(report))


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
    prompt_content_diff = compute_prompt_content_diff(
        db,
        project_id=regression.project_id,
        current_traces=result.current_representative_traces,
        baseline_traces=result.baseline_representative_traces,
    )
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
        prompt_content_diff=prompt_content_diff,
    )


@router.get("/traces", response_model=TraceListResponse)
def list_traces_endpoint(
    filters: TraceListQuery = Depends(),
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> TraceListResponse:
    if x_api_key is not None:
        if filters.project_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required for API-key trace queries")
        project = _project_from_session_or_api_key(
            db=db,
            project_id=filters.project_id,
            x_api_key=x_api_key,
            authorization=authorization,
        )
        if filters.environment is not None:
            resolve_project_environment(db, project=project, name=filters.environment)
        result = list_traces(db, _operator_context_for_public_project(project), filters)
        return TraceListResponse(items=result.items, next_cursor=result.next_cursor)

    operator = require_operator(authorization=authorization, db=db)
    if filters.project_id is not None:
        require_project_access(db, operator, filters.project_id)
        if filters.environment is not None:
            require_environment_access(db, operator, filters.project_id, filters.environment)
    result = list_traces(db, operator, filters)
    return TraceListResponse(items=result.items, next_cursor=result.next_cursor)


@router.get("/projects/{project_id}/traces", response_model=TraceListResponse)
def list_project_traces_endpoint(
    project_id: UUID,
    filters: TraceListQuery = Depends(),
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> TraceListResponse:
    if x_api_key is not None:
        project = _project_from_session_or_api_key(
            db=db,
            project_id=project_id,
            x_api_key=x_api_key,
            authorization=authorization,
        )
        if filters.environment is not None:
            resolve_project_environment(db, project=project, name=filters.environment)
        result = list_traces(
            db,
            _operator_context_for_public_project(project),
            filters.model_copy(update={"project_id": project_id}),
        )
        return TraceListResponse(items=result.items, next_cursor=result.next_cursor)

    operator = require_operator(authorization=authorization, db=db)
    require_project_access(db, operator, project_id)
    if filters.environment is not None:
        require_environment_access(db, operator, project_id, filters.environment)
    result = list_traces(db, operator, filters.model_copy(update={"project_id": project_id}))
    return TraceListResponse(items=result.items, next_cursor=result.next_cursor)


@router.post("/projects/{project_id}/trace-cohorts", response_model=TraceCohortResponse)
def query_trace_cohort_endpoint(
    project_id: UUID,
    payload: TraceCohortRequest,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceCohortResponse:
    project = require_project_access(db, operator, project_id)
    cohort = query_trace_cohort(
        db,
        project=project,
        filters=payload.filters,
        aggregation=payload.aggregation,
    )
    _, metrics = aggregate_cohort_metrics(
        db,
        project=project,
        filters=payload.filters,
    )
    return TraceCohortResponse(
        project_id=project.id,
        backend=cohort.backend,
        metrics=TraceCohortMetricsRead(
            trace_count=metrics["trace_count"],
            error_rate=metrics["error_rate"],
            average_latency_ms=metrics["average_latency_ms"],
            structured_output_validity=metrics["structured_output_validity_rate"],
            average_cost_usd=metrics["average_cost_usd"],
        ),
        items=[_trace_list_item(item) for item in cohort.items],
    )


@router.get("/traces/{trace_id}", response_model=TraceDetailRead)
def get_trace_detail_endpoint(
    trace_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> TraceDetailRead:
    if x_api_key is not None:
        public_key = _public_api_key_from_headers(db=db, x_api_key=x_api_key, authorization=authorization)
        trace = resolve_trace_identifier(db, trace_id)
        if trace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
        if trace.organization_id != public_key.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        project = db.get(Project, trace.project_id)
        assert project is not None
        trace = get_trace_detail_by_identifier(db, _operator_context_for_public_project(project), trace_id)
    else:
        operator = require_operator(authorization=authorization, db=db)
        trace = get_trace_detail_by_identifier(db, operator, trace_id)
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


@router.get("/traces/{trace_id}/summary", response_model=TraceSummaryRead)
def get_trace_summary_endpoint(
    trace_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> TraceSummaryRead:
    if x_api_key is not None:
        public_key = _public_api_key_from_headers(db=db, x_api_key=x_api_key, authorization=authorization)
        trace = resolve_trace_identifier(db, trace_id)
        if trace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
        if trace.organization_id != public_key.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    else:
        operator = require_operator(authorization=authorization, db=db)
        trace = resolve_trace_identifier(db, trace_id)
        if trace is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
        require_project_access(db, operator, trace.project_id)
    return TraceSummaryRead.model_validate(get_trace_summary_by_identifier(db, trace_id))


@router.post("/integrations/github/webhook", response_model=GitHubWebhookProcessRead)
async def github_comment_webhook_endpoint(
    payload: GitHubCommentWebhookRead,
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
) -> GitHubWebhookProcessRead:
    verify_github_signature(await request.body(), x_hub_signature_256)
    posted_trace_ids = process_github_comment_webhook(db, payload.model_dump())
    return GitHubWebhookProcessRead(status="ok", posted_trace_ids=posted_trace_ids)


@router.get("/traces/{trace_id}/graph", response_model=TraceGraphRead)
def get_trace_graph_endpoint(
    trace_id: str,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceGraphRead:
    graph = get_trace_graph(db, operator, trace_id)
    return TraceGraphRead(
        trace_id=graph["trace_id"],
        project_id=graph["project_id"],
        environment=graph["environment"],
        nodes=[TraceGraphNodeRead.model_validate(item) for item in graph["nodes"]],
        edges=[TraceGraphEdgeRead.model_validate(item) for item in graph["edges"]],
    )


@router.get("/traces/{trace_id}/replay", response_model=TraceReplayRead)
def get_trace_replay_endpoint(
    trace_id: str,
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TraceReplayRead:
    replay = get_trace_replay(db, trace_id)
    _trace_replay_access_from_headers(
        db=db,
        trace_project_id=replay["project_id"],
        trace_organization_id=replay["organization_id"],
        x_api_key=x_api_key,
        authorization=authorization,
    )
    return TraceReplayRead(
        trace_id=replay["trace_id"],
        project_id=replay["project_id"],
        environment=replay["environment"],
        steps=[TraceReplayStepRead.model_validate(item) for item in replay["steps"]],
    )


@router.get("/traces/{trace_id}/analysis", response_model=TraceGraphAnalysisRead)
def get_trace_graph_analysis_endpoint(
    trace_id: str,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceGraphAnalysisRead:
    analysis = get_trace_graph_analysis(db, operator, trace_id)
    return TraceGraphAnalysisRead(
        trace_id=analysis["trace_id"],
        slowest_span=(
            TraceGraphAnalysisSpanRead.model_validate(analysis["slowest_span"])
            if analysis["slowest_span"] is not None
            else None
        ),
        largest_token_span=(
            TraceGraphAnalysisSpanRead.model_validate(analysis["largest_token_span"])
            if analysis["largest_token_span"] is not None
            else None
        ),
        most_guardrail_retries=(
            TraceGraphAnalysisSpanRead.model_validate(analysis["most_guardrail_retries"])
            if analysis["most_guardrail_retries"] is not None
            else None
        ),
    )


@router.get("/traces/{trace_id}/compare", response_model=TraceComparisonRead)
def get_trace_compare_endpoint(
    trace_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceComparisonRead:
    result = get_trace_compare(db, operator, trace_id)
    prompt_content_diff = compute_prompt_content_diff(
        db,
        project_id=result.trace.project_id,
        current_traces=[result.trace],
        baseline_traces=[result.baseline_trace] if result.baseline_trace is not None else [],
    )
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
        prompt_content_diff=prompt_content_diff,
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
    project = require_project_role(db, operator, project_id, "engineer")
    key_record, plaintext_key = create_api_key(db, project.id, payload)
    return APIKeyCreateResponse(
        api_key=plaintext_key, api_key_record=APIKeyRead.model_validate(key_record)
    )


@router.post(
    "/projects/{project_id}/ingest/traces",
    response_model=TraceAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def ingest_project_trace_endpoint(
    project_id: UUID,
    payload: TraceIngestRequest,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> TraceAcceptedResponse:
    project = _project_from_session_or_api_key(
        db=db,
        project_id=project_id,
        x_api_key=x_api_key,
        authorization=authorization,
    )
    enforce_rate_limit(
        scope="trace_ingest",
        key=str(project.organization_id),
        limit=get_settings().ingest_rate_limit_per_minute,
        window_seconds=60,
    )
    trace = ingest_trace(db, SimpleNamespace(project_id=project.id), payload)
    return TraceAcceptedResponse(trace_id=trace.id)


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
    project = db.get(Project, api_key.project_id)
    assert project is not None
    enforce_rate_limit(
        scope="trace_ingest",
        key=str(project.organization_id),
        limit=get_settings().ingest_rate_limit_per_minute,
        window_seconds=60,
    )
    trace = ingest_trace(db, api_key, payload)
    return TraceAcceptedResponse(trace_id=trace.id)


@router.post(
    "/projects/{project_id}/sdk-events",
    status_code=status.HTTP_202_ACCEPTED,
)
def create_sdk_event_endpoint(
    project_id: UUID,
    payload: SDKTelemetryEventCreate,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> Response:
    project = _project_from_session_or_api_key(
        db=db,
        project_id=project_id,
        x_api_key=x_api_key,
        authorization=authorization,
    )
    environment = resolve_project_environment(db, project=project, name=payload.environment or project.environment)
    event_type = "sdk_request"
    if payload.error:
        event_type = "sdk_error"
    elif payload.retry:
        event_type = "sdk_retry"
    elif payload.latency_ms is not None:
        event_type = "sdk_latency"
    sdk_payload = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "organization_id": str(project.organization_id),
        "project_id": str(project.id),
        "environment_id": str(environment.id),
        "sdk_version": payload.sdk_version,
        "language": payload.language,
        "latency_ms": payload.latency_ms,
        "error": payload.error,
        "retry": payload.retry,
    }
    publish_event(get_settings().event_stream_topic_traces, sdk_payload)
    record_sdk_event(db, sdk_payload)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/runtime/guardrail-events",
    response_model=RuntimeGuardrailEventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_runtime_guardrail_event_endpoint(
    payload: RuntimeGuardrailEventCreate,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> RuntimeGuardrailEventRead:
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required",
        )
    api_key = authenticate_api_key(db, provided_key)
    if api_key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    try:
        event = record_runtime_guardrail_event(
            db,
            project_id=api_key.project_id,
            trace_id=payload.trace_id,
            policy_id=payload.policy_id,
            action_taken=payload.action_taken,
            provider_model=payload.provider_model,
            latency_ms=payload.latency_ms,
            metadata_json=payload.metadata_json,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _runtime_guardrail_event_item(event)


@router.post(
    "/projects/{project_id}/runtime/guardrail-events",
    response_model=RuntimeGuardrailEventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_runtime_guardrail_event_endpoint(
    project_id: UUID,
    payload: RuntimeGuardrailEventCreate,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> RuntimeGuardrailEventRead:
    _project_from_session_or_api_key(
        db=db,
        project_id=project_id,
        x_api_key=x_api_key,
        authorization=authorization,
    )
    try:
        event = record_runtime_guardrail_event(
            db,
            project_id=project_id,
            trace_id=payload.trace_id,
            policy_id=payload.policy_id,
            action_taken=payload.action_taken,
            provider_model=payload.provider_model,
            latency_ms=payload.latency_ms,
            metadata_json=payload.metadata_json,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _runtime_guardrail_event_item(event)


@router.post(
    "/runtime/policy-violations",
    status_code=status.HTTP_202_ACCEPTED,
)
def create_policy_violation_event_endpoint(
    payload: PolicyViolationEventCreate,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> Response:
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key is required")
    api_key = authenticate_api_key(db, provided_key)
    if api_key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    project = db.get(Project, api_key.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    environment = resolve_project_environment(db, project=project, name=project.environment)
    publish_event(
        get_settings().event_stream_topic_traces,
        PolicyViolationEventPayload(
            organization_id=str(project.organization_id),
            project_id=str(project.id),
            environment_id=str(environment.id),
            trace_id=payload.trace_id,
            timestamp=datetime.now(timezone.utc),
            policy_type=payload.policy_type,
            enforcement_mode=payload.enforcement_mode,
            action_taken=payload.action_taken,
            metadata={
                "provider_model": payload.provider_model,
                "latency_ms": payload.latency_ms,
                **(payload.metadata_json or {}),
            }
            or None,
        ).model_dump(mode="json"),
    )
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.get(
    "/runtime/guardrails",
    response_model=RuntimeGuardrailPolicyListResponse,
)
def list_runtime_guardrails_endpoint(
    environment: str | None = None,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> RuntimeGuardrailPolicyListResponse:
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required",
        )
    api_key = authenticate_api_key(db, provided_key)
    if api_key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    policies = get_active_guardrail_policies(
        db,
        project_id=api_key.project_id,
        environment=environment,
    )
    return RuntimeGuardrailPolicyListResponse(
        policies=[_runtime_guardrail_policy_item(policy) for policy in policies]
    )
