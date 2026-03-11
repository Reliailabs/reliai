import "server-only";

import type {
  AlertDeliveryListResponse,
  CustomerReliabilityDetailRead,
  CustomerReliabilityListRead,
  DeploymentDetailRead,
  DeploymentListResponse,
  EventPipelineRead,
  EnvironmentListResponse,
  ExternalProcessorListResponse,
  ExternalProcessorRead,
  GuardrailMetrics,
  IncidentCommandCenterRead,
  IncidentDetailRead,
  IncidentInvestigationRead,
  IncidentEventListResponse,
  IncidentListResponse,
  ModelVersionDetailRead,
  ModelVersionListResponse,
  OrganizationAlertTargetRead,
  OrganizationAlertTargetTestResponse,
  OrganizationRead,
  ProjectListResponse,
  ProjectReliabilityControlPanel,
  ProjectReliabilityRead,
  ProjectRead,
  PlatformMetricsRead,
  GraphGuardrailRecommendationListResponse,
  ReliabilityActionLogListResponse,
  ReliabilityGraphOverviewRead,
  ReliabilityGraphPatternListResponse,
  ReliabilityPatternListResponse,
  ReliabilityPatternRead,
  ReliabilityRecommendation,
  PromptVersionDetailRead,
  PromptVersionListResponse,
  RegressionDetailRead,
  RegressionListResponse,
  SystemGrowthRead,
  TraceIngestionPolicyRead,
  TimelineResponse,
  TraceComparisonRead,
  TraceDetailRead,
  TraceListResponse
} from "@reliai/types";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = await getApiAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getApiHealth() {
  return request<{ status: string }>("/api/v1/health");
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  plan: OrganizationRead["plan"];
  owner_auth_user_id: string;
  owner_role: "owner";
}) {
  return request<OrganizationRead>("/api/v1/organizations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getOrganization(organizationId: string) {
  return request<OrganizationRead>(`/api/v1/organizations/${organizationId}`);
}

export async function getProject(projectId: string) {
  return request<ProjectRead>(`/api/v1/projects/${projectId}`);
}

export async function listProjectEnvironments(projectId: string) {
  return request<EnvironmentListResponse>(`/api/v1/projects/${projectId}/environments`);
}

export async function getProjectReliability(projectId: string, environment?: string) {
  const params = new URLSearchParams();
  if (environment) params.set("environment", environment);
  const query = params.toString();
  return request<ProjectReliabilityRead>(`/api/v1/projects/${projectId}/reliability${query ? `?${query}` : ""}`);
}

export async function getProjectGuardrailMetrics(projectId: string, environment?: string) {
  const params = new URLSearchParams();
  if (environment) params.set("environment", environment);
  const query = params.toString();
  return request<GuardrailMetrics>(`/api/v1/projects/${projectId}/guardrail-metrics${query ? `?${query}` : ""}`);
}

export async function getProjectReliabilityControlPanel(projectId: string, environment?: string) {
  const params = new URLSearchParams();
  if (environment) params.set("environment", environment);
  const query = params.toString();
  return request<ProjectReliabilityControlPanel>(`/api/v1/projects/${projectId}/control-panel${query ? `?${query}` : ""}`);
}

export async function listProjectAutomationActions(projectId: string) {
  return request<ReliabilityActionLogListResponse>(`/api/v1/projects/${projectId}/automation-actions`);
}

export async function getProjectRecommendations(projectId: string) {
  return request<ReliabilityRecommendation[]>(`/api/v1/projects/${projectId}/recommendations`);
}

export async function getProjectIngestionPolicy(projectId: string) {
  return request<TraceIngestionPolicyRead>(`/api/v1/projects/${projectId}/ingestion-policy`);
}

export async function updateProjectIngestionPolicy(
  projectId: string,
  payload: {
    sampling_success_rate: number;
    sampling_error_rate: number;
    max_metadata_fields: number;
    max_cardinality_per_field: number;
    retention_days_success: number;
    retention_days_error: number;
  }
) {
  return request<TraceIngestionPolicyRead>(`/api/v1/projects/${projectId}/ingestion-policy`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function getSystemEventPipeline() {
  return request<{ pipeline: EventPipelineRead }>(`/api/v1/system/event-pipeline`);
}

export async function listProjectProcessors(projectId: string) {
  return request<ExternalProcessorListResponse>(`/api/v1/projects/${projectId}/processors`);
}

export async function createProjectProcessor(
  projectId: string,
  payload: {
    name: string;
    event_type: string;
    endpoint_url: string;
    secret: string;
    enabled?: boolean;
  }
) {
  return request<ExternalProcessorRead>(`/api/v1/projects/${projectId}/processors`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProjectProcessor(
  projectId: string,
  processorId: string,
  payload: {
    name?: string;
    endpoint_url?: string;
    secret?: string;
    enabled?: boolean;
  }
) {
  return request<ExternalProcessorRead>(`/api/v1/projects/${projectId}/processors/${processorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getSystemGrowth() {
  return request<SystemGrowthRead>(`/api/v1/system/growth`);
}

export async function getSystemPlatform() {
  return request<PlatformMetricsRead>(`/api/v1/system/platform`);
}

export async function getSystemCustomers() {
  return request<CustomerReliabilityListRead>(`/api/v1/system/customers`);
}

export async function getSystemCustomerDetail(projectId: string) {
  return request<CustomerReliabilityDetailRead>(`/api/v1/system/customers/${projectId}`);
}

export async function getReliabilityPatterns() {
  return request<ReliabilityPatternListResponse>(`/api/v1/intelligence/patterns`);
}

export async function getReliabilityGraphOverview() {
  return request<ReliabilityGraphOverviewRead>(`/api/v1/intelligence/graph`);
}

export async function getReliabilityGraphHighRiskPatterns() {
  return request<ReliabilityGraphPatternListResponse>(`/api/v1/intelligence/high-risk-patterns`);
}

export async function getReliabilityGraphGuardrailRecommendations() {
  return request<GraphGuardrailRecommendationListResponse>(`/api/v1/intelligence/guardrail-recommendations`);
}

export async function getSystemGlobalIntelligence() {
  return request<ReliabilityGraphPatternListResponse>(`/api/v1/system/global-intelligence`);
}

export async function getReliabilityPattern(patternId: string) {
  return request<ReliabilityPatternRead>(`/api/v1/intelligence/patterns/${patternId}`);
}

export async function getProjectTimeline(projectId: string, limit = 100, environment?: string) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (environment) params.set("environment", environment);
  return request<TimelineResponse>(`/api/v1/projects/${projectId}/timeline?${params.toString()}`);
}

export async function listProjects(filters: { organizationId?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set("organization_id", filters.organizationId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<ProjectListResponse>(`/api/v1/projects${query ? `?${query}` : ""}`);
}

export interface TraceFilters {
  projectId?: string;
  environment?: string;
  promptVersionId?: string;
  modelVersionId?: string;
  modelName?: string;
  promptVersion?: string;
  success?: "true" | "false";
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export async function listTraces(filters: TraceFilters = {}) {
  const params = new URLSearchParams();

  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.promptVersionId) params.set("prompt_version_id", filters.promptVersionId);
  if (filters.modelVersionId) params.set("model_version_id", filters.modelVersionId);
  if (filters.modelName) params.set("model_name", filters.modelName);
  if (filters.promptVersion) params.set("prompt_version", filters.promptVersion);
  if (filters.success) params.set("success", filters.success);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();
  return request<TraceListResponse>(`/api/v1/traces${query ? `?${query}` : ""}`);
}

export async function getTraceDetail(traceId: string) {
  return request<TraceDetailRead>(`/api/v1/traces/${traceId}`);
}

export async function getTraceCompare(traceId: string) {
  return request<TraceComparisonRead>(`/api/v1/traces/${traceId}/compare`);
}

export async function listIncidents(filters: {
  projectId?: string;
  environment?: string;
  status?: "open" | "resolved";
  severity?: "critical" | "high" | "medium" | "low";
  ownerOperatorUserId?: string;
  ownerState?: "assigned" | "unassigned";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("project_id", filters.projectId);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.ownerOperatorUserId) params.set("owner_operator_user_id", filters.ownerOperatorUserId);
  if (filters.ownerState) params.set("owner_state", filters.ownerState);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<IncidentListResponse>(`/api/v1/incidents${query ? `?${query}` : ""}`);
}

export async function getIncidentDetail(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}`);
}

export async function getIncidentCommandCenter(incidentId: string) {
  return request<IncidentCommandCenterRead>(`/api/v1/incidents/${incidentId}/command`);
}

export async function getIncidentInvestigation(incidentId: string) {
  return request<IncidentInvestigationRead>(`/api/v1/incidents/${incidentId}/investigation`);
}

export async function getIncidentTraceCompare(incidentId: string) {
  return request<TraceComparisonRead>(`/api/v1/incidents/${incidentId}/compare`);
}

export async function acknowledgeIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/acknowledge`, {
    method: "POST"
  });
}

export async function assignIncidentOwner(
  incidentId: string,
  ownerOperatorUserId: string | null
) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/owner`, {
    method: "POST",
    body: JSON.stringify({ owner_operator_user_id: ownerOperatorUserId })
  });
}

export async function getIncidentAlerts(incidentId: string) {
  return request<AlertDeliveryListResponse>(`/api/v1/incidents/${incidentId}/alerts`);
}

export async function getIncidentEvents(incidentId: string) {
  return request<IncidentEventListResponse>(`/api/v1/incidents/${incidentId}/events`);
}

export async function resolveIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/resolve`, {
    method: "POST"
  });
}

export async function reopenIncident(incidentId: string) {
  return request<IncidentDetailRead>(`/api/v1/incidents/${incidentId}/reopen`, {
    method: "POST"
  });
}

export async function listProjectRegressions(projectId: string, limit = 25) {
  return request<RegressionListResponse>(`/api/v1/projects/${projectId}/regressions?limit=${encodeURIComponent(String(limit))}`);
}

export async function listProjectRegressionsFiltered(
  projectId: string,
  filters: {
    metricName?: string;
    scopeId?: string;
    limit?: number;
  } = {}
) {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 25));
  if (filters.metricName) params.set("metric_name", filters.metricName);
  if (filters.scopeId) params.set("scope_id", filters.scopeId);
  return request<RegressionListResponse>(`/api/v1/projects/${projectId}/regressions?${params.toString()}`);
}

export async function getRegressionDetail(regressionId: string) {
  return request<RegressionDetailRead>(`/api/v1/regressions/${regressionId}`);
}

export async function getRegressionCompare(regressionId: string) {
  return request<TraceComparisonRead>(`/api/v1/regressions/${regressionId}/compare`);
}

export async function getDeploymentDetail(deploymentId: string) {
  return request<DeploymentDetailRead>(`/api/v1/deployments/${deploymentId}`);
}

export async function listProjectDeployments(projectId: string, environment?: string) {
  const params = new URLSearchParams();
  if (environment) params.set("environment", environment);
  const query = params.toString();
  return request<DeploymentListResponse>(
    `/api/v1/projects/${projectId}/deployments${query ? `?${query}` : ""}`
  );
}

export async function listProjectPromptVersions(projectId: string) {
  return request<PromptVersionListResponse>(`/api/v1/projects/${projectId}/prompt-versions`);
}

export async function getPromptVersionDetail(projectId: string, promptVersionId: string) {
  return request<PromptVersionDetailRead>(
    `/api/v1/projects/${projectId}/prompt-versions/${promptVersionId}`
  );
}

export async function listProjectModelVersions(projectId: string) {
  return request<ModelVersionListResponse>(`/api/v1/projects/${projectId}/model-versions`);
}

export async function getModelVersionDetail(projectId: string, modelVersionId: string) {
  return request<ModelVersionDetailRead>(
    `/api/v1/projects/${projectId}/model-versions/${modelVersionId}`
  );
}

export async function getOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target`);
}

export async function upsertOrgAlertTarget(
  organizationId: string,
  payload: {
    channel_target: string;
    slack_webhook_url?: string;
    is_active: boolean;
  }
) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function enableOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target/enable`, {
    method: "POST"
  });
}

export async function disableOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetRead>(`/api/v1/organizations/${organizationId}/alert-target/disable`, {
    method: "POST"
  });
}

export async function testOrgAlertTarget(organizationId: string) {
  return request<OrganizationAlertTargetTestResponse>(`/api/v1/organizations/${organizationId}/alert-target/test`, {
    method: "POST"
  });
}
