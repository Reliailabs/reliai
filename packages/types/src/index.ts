export type OnboardingStep = "organization" | "project" | "api_key" | "trace";

export interface OrganizationRead {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pilot" | "growth" | "enterprise";
  created_at: string;
  updated_at: string;
}

export interface OrganizationAlertTargetRead {
  id: string;
  organization_id: string;
  channel_type: string;
  channel_target: string;
  is_active: boolean;
  has_secret: boolean;
  webhook_masked: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationAlertTargetTestResponse {
  success: boolean;
  detail: string;
  tested_at: string;
}

export interface OrganizationGuardrailPolicyRead {
  id: string;
  organization_id: string;
  policy_type: string;
  config_json: Record<string, unknown>;
  enforcement_mode: "observe" | "warn" | "enforce" | "block";
  enabled: boolean;
  created_at: string;
}

export interface OrganizationGuardrailPolicyListResponse {
  items: OrganizationGuardrailPolicyRead[];
}

export interface ProjectRead {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: "production" | "staging" | "development";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  environments: EnvironmentRead[];
}

export interface ProjectListResponse {
  items: ProjectRead[];
}

export interface EnvironmentRead {
  id: string;
  project_id: string;
  name: string;
  type: "production" | "staging" | "development";
  created_at: string;
}

export interface EnvironmentListResponse {
  items: EnvironmentRead[];
}

export interface ReliabilityMetricPointRead {
  metric_name: string;
  window_minutes: number;
  window_start: string;
  window_end: string;
  value_number: number;
  numerator: number | null;
  denominator: number | null;
  unit: string;
  computed_at: string;
  metadata_json: Record<string, unknown> | null;
}

export interface ReliabilityMetricSeriesRead {
  metric_name: string;
  unit: string;
  points: ReliabilityMetricPointRead[];
}

export interface ReliabilityRecentIncidentRead {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  started_at: string;
  updated_at: string;
}

export interface ProjectReliabilityRead {
  project_id: string;
  organization_id: string;
  reliability_score: number | null;
  detection_latency_p90: number | null;
  MTTA_p90: number | null;
  MTTR_p90: number | null;
  false_positive_rate: number | null;
  detection_coverage: number | null;
  alert_delivery_success_rate: number | null;
  explainability_score: number | null;
  incident_density: number | null;
  telemetry_freshness_minutes: number | null;
  quality_pass_rate: number | null;
  structured_output_validity_rate: number | null;
  root_cause_localization_score: number | null;
  recent_incidents: ReliabilityRecentIncidentRead[];
  trend_series: ReliabilityMetricSeriesRead[];
}

export interface GuardrailPolicyMetrics {
  policy_id: string;
  policy_type: string;
  action: string;
  trigger_count: number;
  last_triggered_at: string | null;
}

export interface GuardrailRuntimeEventSummary {
  policy_type: string;
  action_taken: string;
  provider_model: string | null;
  latency_ms: number | null;
  created_at: string;
  trace_id: string;
  trace_available: boolean;
}

export interface GuardrailTracePolicyCountRead {
  policy_type: string;
  trigger_count: number;
}

export interface GuardrailMetrics {
  policies: GuardrailPolicyMetrics[];
  recent_events: GuardrailRuntimeEventSummary[];
  trace_policy_counts: GuardrailTracePolicyCountRead[];
}

export interface ControlPanelDeploymentRisk {
  latest_deployment_id: string | null;
  deployed_at: string | null;
  risk_score: number | null;
  risk_level: string | null;
}

export interface ControlPanelSimulation {
  latest_simulation_id: string | null;
  predicted_failure_rate: number | null;
  predicted_latency: number | null;
  risk_level: string | null;
  created_at: string | null;
}

export interface ControlPanelRecentIncident {
  incident_id: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
}

export interface ControlPanelIncidents {
  recent_incidents: ControlPanelRecentIncident[];
  incident_rate_last_24h: number;
}

export interface ControlPanelGuardrails {
  trigger_rate_last_24h: number;
  top_triggered_policy: string | null;
}

export interface ControlPanelGuardrailActivity {
  policy_type: string;
  trigger_count: number;
}

export interface ControlPanelGuardrailCompliance {
  policy_type: string;
  enforcement_mode: string;
  coverage_pct: number;
  violation_count: number;
}

export interface ControlPanelModelReliability {
  current_model: string | null;
  success_rate: number | null;
  average_latency: number | null;
  structured_output_validity: number | null;
}

export interface ControlPanelGraphPattern {
  pattern: string;
  risk_level: string;
  trace_count: number;
  confidence: number;
}

export interface ControlPanelRecommendedGuardrail {
  policy_type: string;
  recommended_action: string;
  title: string;
  confidence: number;
  model_family: string | null;
}

export interface ControlPanelModelFailureSignal {
  pattern: string;
  risk_level: string;
  confidence: number;
}

export interface ReliabilityActionLogRead {
  id: string;
  project_id: string;
  rule_id: string | null;
  action_type: string;
  target: string;
  status: string;
  detail_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ReliabilityActionLogListResponse {
  items: ReliabilityActionLogRead[];
}

export interface ControlPanelAutomaticAction {
  action_id: string;
  action_type: string;
  target: string;
  status: string;
  created_at: string;
}

export interface ControlPanelAutomaticActions {
  recent_actions: ControlPanelAutomaticAction[];
}

export interface ControlPanelRecentDeployment {
  deployment_id: string;
  deployed_at: string;
  environment: string;
  risk_level: string | null;
  risk_score: number | null;
}

export interface ProjectReliabilityControlPanel {
  reliability_score: number;
  traces_last_24h: number;
  traces_per_second?: number;
  active_incidents: number;
  active_services: number;
  deployment_risk: ControlPanelDeploymentRisk;
  simulation: ControlPanelSimulation;
  incidents: ControlPanelIncidents;
  guardrails: ControlPanelGuardrails;
  guardrail_activity: ControlPanelGuardrailActivity[];
  guardrail_compliance: ControlPanelGuardrailCompliance[];
  model_reliability: ControlPanelModelReliability;
  high_risk_patterns: ControlPanelGraphPattern[];
  graph_high_risk_patterns: ControlPanelGraphPattern[];
  recommended_guardrails: ControlPanelRecommendedGuardrail[];
  model_failure_signals: ControlPanelModelFailureSignal[];
  recent_deployments: ControlPanelRecentDeployment[];
  automatic_actions: ControlPanelAutomaticActions;
}

export interface EventPipelineConsumerRead {
  consumer_name: string;
  topic: string;
  health: string;
  processing_rate_per_minute: number;
  lag: number;
  processed_events_total: number;
  processed_events_recent: number;
  error_count_total: number;
  error_count_recent: number;
  average_processing_latency_ms: number | null;
  last_processed_at: string | null;
  last_error_at: string | null;
}

export interface EventPipelineRead {
  topic: string;
  dead_letter_topic: string | null;
  total_events_published: number;
  recent_events_published: number;
  window_minutes: number;
  consumers: EventPipelineConsumerRead[];
}

export interface PlatformMetricsRead {
  trace_ingest_rate: number;
  pipeline_latency: number | null;
  processor_failure_rate: number;
  warehouse_lag: number;
  warehouse_rows: number;
  active_partitions: number;
  scan_rate: number;
  avg_query_latency: number;
  archive_backlog: number;
  customer_overload_risk: string;
}

export interface ExternalProcessorRead {
  id: string;
  project_id: string;
  name: string;
  event_type: string;
  endpoint_url: string;
  enabled: boolean;
  has_secret: boolean;
  created_at: string;
  recent_failure_count: number;
  last_failure_at: string | null;
}

export interface ExternalProcessorListResponse {
  items: ExternalProcessorRead[];
}

export interface PlatformExtensionRead {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  processor_id: string | null;
  name: string;
  processor_type: string;
  version: string;
  event_type: string;
  endpoint_url: string;
  enabled: boolean;
  config_json: Record<string, unknown>;
  health: string;
  event_throughput_per_hour: number;
  recent_failure_count: number;
  last_invoked_at: string | null;
  last_failure_at: string | null;
  created_at: string | null;
}

export interface PlatformExtensionListResponse {
  items: PlatformExtensionRead[];
}

export interface MetadataCardinalityRead {
  field_name: string;
  unique_values_count: number;
  limit_reached: boolean;
}

export interface TraceIngestionPolicyRead {
  project_id: string;
  environment_id: string | null;
  sampling_success_rate: number;
  sampling_error_rate: number;
  max_metadata_fields: number;
  max_cardinality_per_field: number;
  retention_days_success: number;
  retention_days_error: number;
  created_at: string;
  sensitive_field_patterns: string[];
  cardinality_summary: MetadataCardinalityRead[];
}

export interface ProjectCustomMetricRead {
  id: string;
  project_id: string;
  name: string;
  metric_key: string;
  metric_type: "regex" | "keyword";
  value_mode: "boolean" | "count";
  pattern: string | null;
  keywords_json: string[] | null;
  enabled: boolean;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCustomMetricListResponse {
  items: ProjectCustomMetricRead[];
}

export interface GrowthDailyPoint {
  date: string;
  count: number;
}

export interface SystemGrowthTraceVolume {
  today: number;
  seven_day_avg: number;
  growth_pct: number;
  daily_points: GrowthDailyPoint[];
}

export interface SystemGrowthIncidentMetrics {
  incidents_detected: number;
  avg_mttr_minutes: number;
  daily_points: GrowthDailyPoint[];
}

export interface SystemGrowthGuardrailMetrics {
  retries: number;
  fallbacks: number;
  blocks: number;
}

export interface SystemGrowthUsageTiers {
  under_1m: number;
  "1m_10m": number;
  "10m_100m": number;
  "100m_plus": number;
}

export interface SystemGrowthRead {
  trace_volume: SystemGrowthTraceVolume;
  incident_metrics: SystemGrowthIncidentMetrics;
  guardrail_metrics: SystemGrowthGuardrailMetrics;
  usage_tiers: SystemGrowthUsageTiers;
  expansion_metrics: {
    median_expansion_ratio: number;
    top_expansion_ratio: number;
    breakout_accounts_detected: number;
    total_telemetry_30d: number;
  };
  usage_expansion_cohort: Array<{
    month_index: number;
    usage_index: number;
    organizations: number;
  }>;
  customer_usage_distribution: Array<{
    rank: number;
    organization_id: string;
    organization_name: string;
    traces_30d: number;
  }>;
}

export interface CustomerExpansionOrganizationRead {
  organization_id: string;
  organization_name: string;
  first_30_day_volume: number;
  current_30_day_volume: number;
  expansion_ratio: number;
  growth_rate: number;
  breakout: boolean;
}

export interface SystemCustomerExpansionRead {
  average_expansion_ratio: number;
  median_expansion_ratio: number;
  top_expansion_ratio: number;
  total_platform_growth_pct: number;
  breakout_customers: number;
  total_telemetry_30d: number;
  organizations: CustomerExpansionOrganizationRead[];
}

export interface CustomerReliabilityProjectRead {
  project_id: string;
  project_name: string;
  trace_volume_24h: number;
  traces_per_day: number;
  guardrail_rate: number;
  incident_rate: number;
  processor_failures: number;
  processor_failure_rate: number;
  pipeline_lag: number;
  risk_level: string;
}

export interface CustomerReliabilityListRead {
  projects: CustomerReliabilityProjectRead[];
}

export interface CustomerReliabilityDailyPointRead {
  date: string;
  trace_volume: number;
}

export interface CustomerReliabilityGuardrailEventRead {
  created_at: string;
  policy_type: string;
  action_taken: string;
  provider_model: string | null;
  latency_ms: number | null;
}

export interface CustomerReliabilityIncidentRead {
  incident_id: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
}

export interface CustomerReliabilityDeploymentRead {
  deployment_id: string;
  environment: string;
  deployed_at: string;
  deployed_by: string | null;
}

export interface CustomerReliabilityProcessorFailureRead {
  failure_id: string;
  processor_name: string;
  event_type: string;
  attempts: number;
  last_error: string;
  created_at: string;
}

export interface CustomerReliabilityDetailRead {
  project: CustomerReliabilityProjectRead;
  trace_volume_chart: CustomerReliabilityDailyPointRead[];
  guardrail_triggers: CustomerReliabilityGuardrailEventRead[];
  incident_history: CustomerReliabilityIncidentRead[];
  deployment_changes: CustomerReliabilityDeploymentRead[];
  processor_failures: CustomerReliabilityProcessorFailureRead[];
  recent_timeline: TimelineEventRead[];
}

export interface ReliabilityPatternRead {
  id: string;
  pattern_type: string;
  model_family: string | null;
  prompt_pattern_hash: string | null;
  failure_type: string;
  failure_probability: number;
  sample_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ReliabilityPatternListResponse {
  items: ReliabilityPatternRead[];
}

export interface ReliabilityGraphNodeRead {
  id: string;
  node_type: string;
  node_key: string;
  metadata_json: Record<string, unknown> | null;
  trace_count: number;
  first_seen: string;
  last_seen: string;
}

export interface ReliabilityGraphEdgeRead {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type: string;
  weight: number;
  confidence: number;
  trace_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReliabilityGraphRelatedNodeRead {
  node: ReliabilityGraphNodeRead;
  edge: ReliabilityGraphEdgeRead;
}

export interface ReliabilityGraphOverviewRead {
  nodes: ReliabilityGraphNodeRead[];
  edges: ReliabilityGraphEdgeRead[];
}

export interface ReliabilityGraphNodeDetailRead {
  node: ReliabilityGraphNodeRead;
  related: ReliabilityGraphRelatedNodeRead[];
}

export interface ReliabilityGraphPatternRead {
  pattern: string;
  risk_level: string;
  traces: number;
  confidence: number;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  source_type?: string | null;
  source_key?: string | null;
  target_type?: string | null;
  target_key?: string | null;
}

export interface ReliabilityGraphPatternListResponse {
  items: ReliabilityGraphPatternRead[];
}

export interface GraphGuardrailRecommendationRead {
  policy_type: string;
  recommended_action: string;
  title: string;
  description: string;
  confidence: number;
  pattern?: string | null;
  model_family?: string | null;
}

export interface GraphGuardrailRecommendationListResponse {
  items: GraphGuardrailRecommendationRead[];
}

export interface GlobalReliabilityPatternRead {
  pattern_id: string;
  pattern_type: string;
  description: string;
  impact: string;
  recommended_guardrails: string[];
  impact_metrics_json?: Record<string, unknown> | null;
  model_family: string;
  issue: string;
  risk_level: string;
  organizations_affected: number;
  trace_count: number;
  first_seen: string | null;
  recommended_guardrail: string;
  confidence: number;
  pattern: string;
}

export interface GlobalReliabilityPatternListResponse {
  patterns: GlobalReliabilityPatternRead[];
}

export interface ReliabilityRecommendation {
  id: string;
  project_id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  evidence_json: Record<string, unknown>;
  created_at: string;
}

export interface TimelineEventRead {
  timestamp: string;
  event_type: string;
  title: string;
  summary: string;
  severity: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TimelineResponse {
  items: TimelineEventRead[];
}

export interface PromptVersionRead {
  id: string;
  project_id: string;
  version: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersionListResponse {
  items: PromptVersionRead[];
}

export interface ModelVersionRead {
  id: string;
  project_id: string;
  provider: string | null;
  model_name: string;
  model_version: string | null;
  model_family: string | null;
  model_revision: string | null;
  route_key: string | null;
  label: string | null;
  identity_key: string;
  created_at: string;
  updated_at: string;
}

export interface ModelVersionListResponse {
  items: ModelVersionRead[];
}

export interface VersionTraceRead {
  id: string;
  request_id: string;
  timestamp: string;
  model_name: string;
  prompt_version: string | null;
  latency_ms: number | null;
  success: boolean;
  error_type: string | null;
  created_at: string;
}

export interface VersionRegressionRead {
  id: string;
  metric_name: string;
  scope_type: string;
  scope_id: string;
  current_value: number;
  baseline_value: number;
  delta_percent: number | null;
  detected_at: string;
}

export interface VersionIncidentRead {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  started_at: string;
  updated_at: string;
}

export interface PromptVersionUsageSummaryRead {
  trace_count: number;
  recent_trace_count: number;
  incident_count: number;
  regression_count: number;
}

export interface PromptVersionDetailRead {
  prompt_version: PromptVersionRead;
  usage_summary: PromptVersionUsageSummaryRead;
  recent_traces: VersionTraceRead[];
  recent_regressions: VersionRegressionRead[];
  related_incidents: VersionIncidentRead[];
  recent_reliability_metrics: ReliabilityMetricPointRead[];
  traces_path: string;
  regressions_path: string;
  incidents_path: string;
}

export interface ModelVersionUsageSummaryRead {
  trace_count: number;
  recent_trace_count: number;
  incident_count: number;
  regression_count: number;
}

export interface ModelVersionDetailRead {
  model_version: ModelVersionRead;
  usage_summary: ModelVersionUsageSummaryRead;
  recent_traces: VersionTraceRead[];
  recent_regressions: VersionRegressionRead[];
  related_incidents: VersionIncidentRead[];
  recent_reliability_metrics: ReliabilityMetricPointRead[];
  traces_path: string;
  regressions_path: string;
  incidents_path: string;
}

export interface DeploymentEventRead {
  id: string;
  deployment_id: string;
  event_type: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface DeploymentRollbackRead {
  id: string;
  deployment_id: string;
  rollback_reason: string;
  rolled_back_at: string;
  created_at: string;
}

export interface DeploymentRead {
  id: string;
  project_id: string;
  environment_id: string;
  prompt_version_id: string | null;
  model_version_id: string | null;
  environment: string;
  deployed_by: string | null;
  deployed_at: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface DeploymentRiskRecommendationRead {
  action: string;
  summary: string;
}

export interface DeploymentRiskRead {
  deployment_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  analysis_json: Record<string, unknown>;
  recommendations: DeploymentRiskRecommendationRead[];
  created_at: string;
}

export interface DeploymentIntelligencePattern {
  pattern: string;
  risk: string;
  trace_count: number;
}

export interface DeploymentIntelligence {
  deployment_id: string;
  risk_score: number | null;
  risk_explanations: string[];
  graph_risk_patterns: DeploymentIntelligencePattern[];
  recommended_guardrails: string[];
}

export interface DeploymentGateRead {
  decision: string;
  risk_score: number;
  explanations: string[];
  recommended_guardrails: string[];
  regression_risk: DeploymentRegressionRiskRead | null;
}

export interface DeploymentRegressionRiskRead {
  is_regression: boolean;
  reasons: string[];
}

export interface DeploymentSimulationRead {
  id: string;
  project_id: string;
  environment_id: string;
  prompt_version_id: string | null;
  model_version_id: string | null;
  trace_sample_size: number;
  predicted_failure_rate: number | null;
  predicted_latency_ms: number | null;
  risk_level: "low" | "medium" | "high" | null;
  analysis_json: Record<string, unknown>;
  created_at: string;
}

export interface DeploymentDetailRead extends DeploymentRead {
  prompt_version: PromptVersionRead | null;
  model_version: ModelVersionRead | null;
  events: DeploymentEventRead[];
  rollbacks: DeploymentRollbackRead[];
  incident_ids: string[];
  latest_risk_score: DeploymentRiskRead | null;
  intelligence: DeploymentIntelligence | null;
  gate: DeploymentGateRead | null;
}

export interface ConfigPatchItem {
  key: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

export interface ConfigSnapshotRead {
  id: string;
  organization_id: string;
  config_json: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  source_trace_id: string | null;
  reason: string | null;
}

export interface ConfigApplyResponse {
  status: string;
  config_snapshot: ConfigSnapshotRead;
}

export interface IncidentDeploymentContextRead {
  deployment: DeploymentRead;
  prompt_version: PromptVersionRead | null;
  model_version: ModelVersionRead | null;
  time_since_deployment_minutes: number;
}

export interface DeploymentListResponse {
  items: DeploymentRead[];
}

export interface RetrievalSpanRead {
  retrieval_latency_ms: number | null;
  source_count: number | null;
  top_k: number | null;
  query_text: string | null;
  retrieved_chunks_json: Array<Record<string, unknown>> | null;
}

export interface EvaluationRead {
  id: string;
  eval_type: string;
  score: string | null;
  label: string | null;
  explanation: string | null;
  evaluator_provider: string | null;
  evaluator_model: string | null;
  evaluator_version: string | null;
  raw_result_json: Record<string, unknown> | null;
  created_at: string;
}

export interface TraceSignalResultRead {
  metric_key: string | null;
  name: string;
  mode: string;
  value: number | boolean | null;
  matched: boolean;
}

export interface TraceListItemRead {
  id: string;
  organization_id: string;
  project_id: string;
  environment: string;
  timestamp: string;
  request_id: string;
  model_name: string;
  model_provider: string | null;
  prompt_version: string | null;
  input_preview: string | null;
  output_preview: string | null;
  latency_ms: number | null;
  success: boolean;
  error_type: string | null;
  created_at: string;
  refusal_detected?: boolean | null;
}

export interface TraceListResponse {
  items: TraceListItemRead[];
  next_cursor: string | null;
}

export interface TraceDetailRead {
  id: string;
  organization_id: string;
  project_id: string;
  environment: string;
  timestamp: string;
  request_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_name: string | null;
  user_id: string | null;
  session_id: string | null;
  model_name: string;
  model_provider: string | null;
  prompt_version: string | null;
  input_text: string | null;
  output_text: string | null;
  input_preview: string | null;
  output_preview: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_cost_usd: string | null;
  success: boolean;
  error_type: string | null;
  guardrail_policy: string | null;
  guardrail_action: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  prompt_version_record: PromptVersionRead | null;
  model_version_record: ModelVersionRead | null;
  registry_pivots: CohortPivotRead[];
  compare_path: string | null;
  retrieval_span: RetrievalSpanRead | null;
  evaluations: EvaluationRead[];
  refusal_detected?: boolean | null;
  custom_metric_results?: TraceSignalResultRead[];
}

export interface TraceGraphNodeRead {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_name: string | null;
  span_type: string | null;
  model_name: string;
  model_provider: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  success: boolean;
  guardrail_policy: string | null;
  guardrail_action: string | null;
  timestamp: string;
  metadata_json: Record<string, unknown> | null;
}

export interface TraceGraphEdgeRead {
  parent_span_id: string;
  child_span_id: string;
}

export interface TraceGraphRead {
  trace_id: string;
  project_id: string;
  environment: string;
  nodes: TraceGraphNodeRead[];
  edges: TraceGraphEdgeRead[];
}

export interface TraceGraphAnalysisSpanRead {
  span_id: string;
  span_name: string | null;
  span_type: string | null;
  latency_ms: number | null;
  token_count: number | null;
  guardrail_policy: string | null;
  retry_count: number | null;
}

export interface TraceGraphAnalysisRead {
  trace_id: string;
  slowest_span: TraceGraphAnalysisSpanRead | null;
  largest_token_span: TraceGraphAnalysisSpanRead | null;
  most_guardrail_retries: TraceGraphAnalysisSpanRead | null;
}

export interface TraceReplayStepRead {
  span_id: string;
  parent_span_id: string | null;
  span_name: string | null;
  span_type: string;
  inputs: Record<string, unknown> | null;
  template: string | null;
  variables: Record<string, unknown> | null;
  model: string | null;
  parameters: Record<string, unknown> | null;
  prompt: string | null;
  tool_name: string | null;
  guardrail_policy: string | null;
  guardrail_action: string | null;
}

export interface TraceReplayRead {
  trace_id: string;
  project_id: string;
  environment: string;
  steps: TraceReplayStepRead[];
}

export interface RegressionSnapshotRead {
  id: string;
  organization_id: string;
  project_id: string;
  metric_name: string;
  current_value: string;
  baseline_value: string;
  delta_absolute: string;
  delta_percent: string | null;
  scope_type: string;
  scope_id: string;
  window_minutes: number;
  detected_at: string;
  metadata_json: Record<string, unknown> | null;
}

export interface RegressionListResponse {
  items: RegressionSnapshotRead[];
}

export interface RegressionRelatedIncidentRead {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  started_at: string;
  updated_at: string;
}

export interface RootCauseHintRead {
  hint_type: string;
  dimension: string;
  current_value: string | null;
  baseline_value: string | null;
  current_count: number | null;
  baseline_count: number | null;
  current_share: string | null;
  baseline_share: string | null;
  current_metric_value: string | null;
  baseline_metric_value: string | null;
  cluster_started_at: string | null;
  supporting_trace_ids: string[];
  metadata_json: Record<string, unknown> | null;
}

export interface DimensionSummaryRead {
  summary_type: string;
  dimension: string;
  current_value: string | null;
  baseline_value: string | null;
  current_count: number | null;
  baseline_count: number | null;
  current_share: string | null;
  baseline_share: string | null;
  delta_value: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface CohortPivotRead {
  pivot_type: string;
  label: string;
  path: string;
  query_params: Record<string, string>;
}

export interface PromptVersionContextRead {
  id: string;
  project_id: string;
  version: string;
  label: string | null;
  current_count: number | null;
  baseline_count: number | null;
  traces_path: string;
  regressions_path: string;
  incidents_path: string;
}

export interface ModelVersionContextRead {
  id: string;
  project_id: string;
  provider: string | null;
  model_name: string;
  model_version: string | null;
  route_key: string | null;
  label: string | null;
  current_count: number | null;
  baseline_count: number | null;
  traces_path: string;
}

export interface TraceDiffBlockRead {
  block_type: string;
  title: string;
  changed: boolean;
  current_value: string | null;
  baseline_value: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface TraceCompareEvaluationRead {
  label: string | null;
  score: string | null;
  reason: string | null;
}

export interface TraceCompareRetrievalRead {
  retrieval_latency_ms: number | null;
  source_count: number | null;
  top_k: number | null;
}

export interface TraceCompareItemRead {
  id: string;
  request_id: string;
  timestamp: string;
  model_name: string;
  prompt_version: string | null;
  success: boolean;
  error_type: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_cost_usd: string | null;
  prompt_version_record: PromptVersionRead | null;
  model_version_record: ModelVersionRead | null;
  structured_output: TraceCompareEvaluationRead | null;
  refusal_detected?: boolean | null;
  custom_metric_results?: TraceSignalResultRead[];
  retrieval: TraceCompareRetrievalRead | null;
  metadata_excerpt_json: Record<string, unknown> | null;
}

export interface TraceComparePairRead {
  pair_index: number;
  current_trace: TraceCompareItemRead | null;
  baseline_trace: TraceCompareItemRead | null;
  diff_blocks: TraceDiffBlockRead[];
}

export interface PromptContentDiffRead {
  from_version: string;
  to_version: string;
  diff: string[];
}

export interface TraceComparisonRead {
  comparison_scope: string;
  source_id: string;
  incident_id: string | null;
  regression_id: string | null;
  project_id: string;
  metric_name: string | null;
  scope_type: string | null;
  scope_id: string | null;
  current_window_start: string | null;
  current_window_end: string | null;
  baseline_window_start: string | null;
  baseline_window_end: string | null;
  current_traces: TraceCompareItemRead[];
  baseline_traces: TraceCompareItemRead[];
  pairs: TraceComparePairRead[];
  dimension_summaries: DimensionSummaryRead[];
  prompt_version_contexts: PromptVersionContextRead[];
  model_version_contexts: ModelVersionContextRead[];
  cohort_pivots: CohortPivotRead[];
  related_incident_id: string | null;
  prompt_content_diff?: PromptContentDiffRead | null;
}

export interface RootCauseProbabilityRead {
  cause_type: string;
  label: string;
  probability: number;
  evidence_json: Record<string, unknown> | null;
}

export interface RootCauseRecommendedFixRead {
  fix_type: string;
  summary: string;
  metadata_json: Record<string, unknown> | null;
}

export interface RegressionDetailRead extends RegressionSnapshotRead {
  related_incident: RegressionRelatedIncidentRead | null;
  root_cause_hints: RootCauseHintRead[];
  dimension_summaries: DimensionSummaryRead[];
  prompt_version_contexts: PromptVersionContextRead[];
  model_version_contexts: ModelVersionContextRead[];
  cohort_pivots: CohortPivotRead[];
  current_representative_traces: TraceCompareItemRead[];
  baseline_representative_traces: TraceCompareItemRead[];
  trace_compare_path: string | null;
}

export interface IncidentTraceSampleRead {
  id: string;
  request_id: string;
  timestamp: string;
  success: boolean;
  error_type: string | null;
  latency_ms: number | null;
  total_cost_usd: string | null;
}

export interface AlertDeliveryRead {
  id: string;
  incident_id: string;
  channel_type: string;
  channel_target: string;
  delivery_status: string;
  provider_message_id: string | null;
  error_message: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AlertDeliveryListResponse {
  items: AlertDeliveryRead[];
}

export interface IncidentListItemRead {
  id: string;
  organization_id: string;
  project_id: string;
  environment_id: string;
  project_name: string;
  incident_type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  status: "open" | "resolved";
  fingerprint: string;
  summary_json: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_operator_user_id: string | null;
  acknowledged_by_operator_email: string | null;
  owner_operator_user_id: string | null;
  owner_operator_email: string | null;
  latest_alert_delivery: AlertDeliveryRead | null;
}

export interface IncidentListResponse {
  items: IncidentListItemRead[];
}

export interface IncidentEventRead {
  id: string;
  incident_id: string;
  event_type:
    | "opened"
    | "updated"
    | "acknowledged"
    | "owner_assigned"
    | "owner_cleared"
    | "resolved"
    | "reopened"
    | "alert_attempted"
    | "alert_sent"
    | "alert_failed"
    | "config_applied"
    | "config_undone";
  actor_operator_user_id: string | null;
  actor_operator_user_email: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface IncidentEventListResponse {
  items: IncidentEventRead[];
}

export interface IncidentDetailRead extends IncidentListItemRead {
  regressions: RegressionSnapshotRead[];
  traces: IncidentTraceSampleRead[];
  events: IncidentEventRead[];
  deployment_context: IncidentDeploymentContextRead | null;
  compare: {
    current_window_start: string | null;
    current_window_end: string | null;
    baseline_window_start: string | null;
    baseline_window_end: string | null;
    regressions: RegressionSnapshotRead[];
    representative_traces: IncidentTraceSampleRead[];
    current_representative_traces: TraceCompareItemRead[];
    baseline_representative_traces: TraceCompareItemRead[];
    root_cause_hints: RootCauseHintRead[];
    dimension_summaries: DimensionSummaryRead[];
    prompt_version_contexts: PromptVersionContextRead[];
    model_version_contexts: ModelVersionContextRead[];
    cohort_pivots: CohortPivotRead[];
    rule_context: {
      incident_type: string;
      metric_name: string;
      comparator: string;
      absolute_threshold: string;
      percent_threshold: string | null;
      minimum_sample_size: number;
    } | null;
    trace_compare_path: string;
  };
}

export interface GuardrailActivityRead {
  policy_type: string;
  trigger_count: number;
  last_trigger_time: string | null;
}

export interface IncidentResolutionImpactRead {
  metric_name: string;
  display_name: string;
  unit?: string | null;
  before_value?: number | null;
  after_value?: number | null;
  delta?: number | null;
  summary?: string | null;
  status?: string | null;
}

export interface IncidentCommandCenterRead {
  incident: IncidentDetailRead;
  root_cause: {
    incident_id: string;
    generated_at: string;
    root_cause_probabilities: RootCauseProbabilityRead[];
    evidence: Record<string, unknown>;
    recommended_fix: RootCauseRecommendedFixRead;
    top_root_cause_probability?: number | null;
    recommendation_confidence?: number | null;
    recommendation_kind?: string | null;
    recommended_action_reason?: string | null;
  };
  metric?: IncidentCommandCenterMetricRead | null;
  resolution_impact?: IncidentResolutionImpactRead | null;
  trace_compare: {
    failing_trace_summary: TraceCompareItemRead | null;
    baseline_trace_summary: TraceCompareItemRead | null;
    compare_link: string;
  };
  deployment_context: IncidentDeploymentContextRead | null;
  guardrail_activity: GuardrailActivityRead[];
  possible_root_causes: Record<string, unknown>[];
  graph_related_patterns: IncidentGraphInsights[];
  similar_platform_failures?: Record<string, unknown>[];
  recommended_mitigations: string[];
  related_regressions: RegressionSnapshotRead[];
  recent_signals: TimelineEventRead[];
}

export interface IncidentCommandCenterMetricRead {
  metric_name: string;
  metric_type: string;
  display_name: string;
  unit?: string | null;
  value?: string | null;
  baseline_value?: string | null;
  delta_percent?: string | null;
}

export interface IncidentGraphInsights {
  pattern: string;
  type: string;
  confidence: number;
  trace_count: number;
}

export interface InvestigationRecommendationRead {
  recommendation_id: string | null;
  recommended_action: string;
  confidence: number;
  supporting_evidence: Record<string, unknown>;
}

export interface InvestigationKeyDifferenceRead {
  dimension: string;
  title: string;
  current_value: string | null;
  baseline_value: string | null;
  changed: boolean;
  metadata_json: Record<string, unknown> | null;
}

export interface IncidentInvestigationRead {
  incident: IncidentDetailRead;
  root_cause_analysis: {
    incident_id: string;
    generated_at: string;
    ranked_causes: RootCauseProbabilityRead[];
    evidence: Record<string, unknown>;
    recommended_fix: RootCauseRecommendedFixRead;
  };
  deployment_context: {
    deployment: IncidentDeploymentContextRead | null;
    latest_risk_score: DeploymentRiskRead | null;
    latest_simulation: DeploymentSimulationRead | null;
    deployment_link: string | null;
  };
  trace_comparison: {
    compare_link: string;
    failing_trace_summary: TraceCompareItemRead | null;
    baseline_trace_summary: TraceCompareItemRead | null;
    comparison: Record<string, unknown>;
    key_differences: InvestigationKeyDifferenceRead[];
  };
  recommendations: InvestigationRecommendationRead[];
  guardrail_activity: GuardrailActivityRead[];
  possible_root_causes: Record<string, unknown>[];
}
