export type OnboardingStep = "organization" | "project" | "api_key" | "trace";

export interface OrganizationRead {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pilot" | "growth" | "enterprise";
  created_at: string;
  updated_at: string;
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
