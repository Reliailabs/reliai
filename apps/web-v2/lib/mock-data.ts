export type Severity = "critical" | "high" | "medium" | "low"
export type IncidentStatus = "open" | "acknowledged" | "resolved"
export type TraceStatus = "success" | "failed" | "refusal"

export interface Incident {
  id: string
  title: string
  status: IncidentStatus
  severity: Severity
  project: string
  metric: string
  model: string
  age: string
  owner?: string
}

export interface Trace {
  id: string
  requestId: string
  status: TraceStatus
  model: string
  promptVersion: string
  latency: string
  tokens: string
  environment: "production" | "staging"
  age: string
}

export interface Change {
  id: string
  type: "deployment" | "prompt" | "model"
  label: string
  project: string
  environment: string
  age: string
}

export const incidents: Incident[] = [
  {
    id: "inc-001",
    title: "Refusal rate spike in production",
    status: "open",
    severity: "critical",
    project: "my-chatbot-prod",
    metric: "refusal_rate",
    model: "gpt-4o",
    age: "14m",
  },
  {
    id: "inc-002",
    title: "Response latency degradation",
    status: "open",
    severity: "high",
    project: "legal-assistant",
    metric: "p95_latency_ms",
    model: "claude-3.5-sonnet",
    age: "1h",
  },
  {
    id: "inc-003",
    title: "Output contract breakage",
    status: "acknowledged",
    severity: "high",
    project: "search-copilot",
    metric: "json_schema_validation",
    model: "gpt-4o",
    age: "2h",
    owner: "alice@acme.com",
  },
  {
    id: "inc-004",
    title: "Model accuracy regression detected",
    status: "open",
    severity: "medium",
    project: "my-chatbot-prod",
    metric: "accuracy_score",
    model: "gpt-4o",
    age: "3h",
  },
  {
    id: "inc-005",
    title: "Token budget exceeded threshold",
    status: "open",
    severity: "medium",
    project: "data-extractor",
    metric: "token_count",
    model: "gpt-4o-mini",
    age: "5h",
  },
  {
    id: "inc-006",
    title: "Retrieval relevance score drop",
    status: "open",
    severity: "low",
    project: "rag-pipeline",
    metric: "retrieval_relevance",
    model: "claude-3.5-sonnet",
    age: "8h",
  },
  {
    id: "inc-007",
    title: "Guardrail policy violation spike",
    status: "resolved",
    severity: "high",
    project: "legal-assistant",
    metric: "policy_violations",
    model: "gpt-4o",
    age: "1d",
    owner: "bob@acme.com",
  },
  {
    id: "inc-008",
    title: "Hallucination rate increase",
    status: "resolved",
    severity: "medium",
    project: "my-chatbot-prod",
    metric: "hallucination_rate",
    model: "gpt-4o",
    age: "2d",
  },
]

export const traces: Trace[] = [
  { id: "tr-001", requestId: "6a2b3f9c", status: "failed",  model: "gpt-4o",           promptVersion: "v2.1.4", latency: "2.41s", tokens: "1,243", environment: "production", age: "2m" },
  { id: "tr-002", requestId: "def4563e", status: "success", model: "gpt-4o",           promptVersion: "v2.1.4", latency: "1.18s", tokens: "892",   environment: "production", age: "3m" },
  { id: "tr-003", requestId: "ghi7892a", status: "success", model: "claude-3.5-sonnet", promptVersion: "v3.0.1", latency: "0.83s", tokens: "654",   environment: "production", age: "4m" },
  { id: "tr-004", requestId: "jkl0128f", status: "refusal", model: "gpt-4o",           promptVersion: "v2.1.4", latency: "0.31s", tokens: "127",   environment: "production", age: "5m" },
  { id: "tr-005", requestId: "mno3451b", status: "success", model: "claude-3.5-sonnet", promptVersion: "v3.0.0", latency: "1.54s", tokens: "2,341", environment: "staging",    age: "6m" },
  { id: "tr-006", requestId: "pqr6784c", status: "success", model: "gpt-4o-mini",      promptVersion: "v1.2.0", latency: "0.51s", tokens: "423",   environment: "production", age: "7m" },
  { id: "tr-007", requestId: "stu9017d", status: "failed",  model: "gpt-4o",           promptVersion: "v2.1.4", latency: "3.22s", tokens: "1,892", environment: "production", age: "9m" },
  { id: "tr-008", requestId: "vwx2345e", status: "success", model: "claude-3.5-sonnet", promptVersion: "v3.0.1", latency: "1.09s", tokens: "1,102", environment: "production", age: "11m" },
  { id: "tr-009", requestId: "yza5679f", status: "success", model: "gpt-4o",           promptVersion: "v2.1.3", latency: "0.92s", tokens: "734",   environment: "staging",    age: "13m" },
  { id: "tr-010", requestId: "bcd8900g", status: "success", model: "gpt-4o-mini",      promptVersion: "v1.2.0", latency: "0.39s", tokens: "289",   environment: "production", age: "15m" },
]

export const changes: Change[] = [
  { id: "ch-001", type: "deployment", label: "v2.1.4 deployed",                   project: "my-chatbot-prod", environment: "production", age: "1h" },
  { id: "ch-002", type: "prompt",     label: "customer-support-v3 activated",     project: "search-copilot",  environment: "production", age: "2h" },
  { id: "ch-003", type: "model",      label: "claude-3.5-sonnet-20241022",        project: "legal-assistant", environment: "production", age: "3h" },
]

export const weeklyIncidents = [
  { day: "Mon", count: 2 },
  { day: "Tue", count: 0 },
  { day: "Wed", count: 1 },
  { day: "Thu", count: 4 },
  { day: "Fri", count: 3 },
  { day: "Sat", count: 1 },
  { day: "Sun", count: 3 },
]
