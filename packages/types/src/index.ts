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

export interface ProjectRead {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: "prod" | "staging" | "dev";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectRead[];
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
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  retrieval_span: RetrievalSpanRead | null;
  evaluations: EvaluationRead[];
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
  structured_output: TraceCompareEvaluationRead | null;
  retrieval: TraceCompareRetrievalRead | null;
  metadata_excerpt_json: Record<string, unknown> | null;
}

export interface TraceComparePairRead {
  pair_index: number;
  current_trace: TraceCompareItemRead | null;
  baseline_trace: TraceCompareItemRead | null;
}

export interface TraceComparisonRead {
  incident_id: string;
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
}

export interface RegressionDetailRead extends RegressionSnapshotRead {
  related_incident: RegressionRelatedIncidentRead | null;
  root_cause_hints: RootCauseHintRead[];
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
    | "alert_failed";
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
