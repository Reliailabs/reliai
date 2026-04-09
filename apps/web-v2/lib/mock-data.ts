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
export const deployments: DeploymentRecord[] = [
  {
    id: "d1", name: "my-chatbot-prod", version: "v2.1.4",
    project: "my-chatbot-prod", model: "gpt-4o",
    status: "live", gateStatus: "pass", riskScore: 78,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 89 },
      { factor: "hallucination_risk",  score: 72 },
      { factor: "latency_regression",  score: 52 },
      { factor: "error_rate_delta",    score: 45 },
      { factor: "token_cost_delta",    score: 18 },
    ],
    age: "14m ago", triggeredBy: "sarah@acme.io", commit: "a3f9c12",
    baseline: "v2.1.3", evalsPassed: 47, evalsTotal: 52,
    guardrailsPassed: 5, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 14:32 UTC",
  },
  {
    id: "d2", name: "legal-assistant", version: "v1.8.2",
    project: "legal-assistant", model: "claude-3.5-sonnet",
    status: "live", gateStatus: "pass", riskScore: 34,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 41 },
      { factor: "hallucination_risk",  score: 38 },
      { factor: "latency_regression",  score: 29 },
      { factor: "error_rate_delta",    score: 12 },
      { factor: "token_cost_delta",    score: 51 },
    ],
    age: "2h ago", triggeredBy: "james@acme.io", commit: "b7e2d44",
    baseline: "v1.8.1", evalsPassed: 61, evalsTotal: 62,
    guardrailsPassed: 5, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 12:41 UTC",
  },
  {
    id: "d3", name: "search-copilot", version: "v3.0.2",
    project: "search-copilot", model: "gpt-4o",
    status: "pending", gateStatus: "pending", riskScore: 55,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 60 },
      { factor: "hallucination_risk",  score: 44 },
      { factor: "latency_regression",  score: 58 },
      { factor: "error_rate_delta",    score: 33 },
      { factor: "token_cost_delta",    score: 22 },
    ],
    age: "5m ago", triggeredBy: "ci-bot", commit: "c9a1f88",
    baseline: "v3.0.1", evalsPassed: 38, evalsTotal: 45,
    guardrailsPassed: 4, guardrailsTotal: 5, deployedAt: "Awaiting gate",
  },
  {
    id: "d4", name: "data-extractor", version: "v2.3.2",
    project: "data-extractor", model: "gpt-4o-mini",
    status: "live", gateStatus: "pass", riskScore: 12,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 8  },
      { factor: "hallucination_risk",  score: 14 },
      { factor: "latency_regression",  score: 10 },
      { factor: "error_rate_delta",    score: 15 },
      { factor: "token_cost_delta",    score: 9  },
    ],
    age: "4h ago", triggeredBy: "james@acme.io", commit: "d2b5e77",
    baseline: "v2.3.1", evalsPassed: 80, evalsTotal: 80,
    guardrailsPassed: 5, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 10:18 UTC",
  },
  {
    id: "d5", name: "rag-pipeline", version: "v0.4.3",
    project: "rag-pipeline", model: "claude-3.5-sonnet",
    status: "rolled_back", gateStatus: "fail", riskScore: 92,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 95 },
      { factor: "hallucination_risk",  score: 88 },
      { factor: "latency_regression",  score: 91 },
      { factor: "error_rate_delta",    score: 89 },
      { factor: "token_cost_delta",    score: 78 },
    ],
    age: "1d ago", triggeredBy: "ci-bot", commit: "e4c8f22",
    baseline: "v0.4.2", evalsPassed: 12, evalsTotal: 45,
    guardrailsPassed: 2, guardrailsTotal: 5, deployedAt: "Apr 8, 2026 16:22 UTC",
  },
  {
    id: "d6", name: "content-moderator", version: "v1.2.1",
    project: "content-moderator", model: "gpt-4o-mini",
    status: "live", gateStatus: "pass", riskScore: 23,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 18 },
      { factor: "hallucination_risk",  score: 25 },
      { factor: "latency_regression",  score: 22 },
      { factor: "error_rate_delta",    score: 19 },
      { factor: "token_cost_delta",    score: 31 },
    ],
    age: "6h ago", triggeredBy: "sarah@acme.io", commit: "f1a9b33",
    baseline: "v1.2.0", evalsPassed: 73, evalsTotal: 75,
    guardrailsPassed: 5, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 08:15 UTC",
  },
  {
    id: "d7", name: "sentiment-analyzer", version: "v0.9.4",
    project: "sentiment-analyzer", model: "claude-3-haiku",
    status: "at_risk", gateStatus: "pass", riskScore: 67,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 71 },
      { factor: "hallucination_risk",  score: 62 },
      { factor: "latency_regression",  score: 68 },
      { factor: "error_rate_delta",    score: 58 },
      { factor: "token_cost_delta",    score: 45 },
    ],
    age: "3h ago", triggeredBy: "ci-bot", commit: "g7d2e55",
    baseline: "v0.9.3", evalsPassed: 42, evalsTotal: 50,
    guardrailsPassed: 4, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 11:30 UTC",
  },
  {
    id: "d8", name: "code-review-assistant", version: "v2.0.1",
    project: "code-review-assistant", model: "gpt-4o",
    status: "failed", gateStatus: "fail", riskScore: 85,
    riskFactors: [
      { factor: "refusal_rate_delta",  score: 82 },
      { factor: "hallucination_risk",  score: 87 },
      { factor: "latency_regression",  score: 79 },
      { factor: "error_rate_delta",    score: 91 },
      { factor: "token_cost_delta",    score: 66 },
    ],
    age: "30m ago", triggeredBy: "james@acme.io", commit: "h3f8c66",
    baseline: "v2.0.0", evalsPassed: 18, evalsTotal: 45,
    guardrailsPassed: 3, guardrailsTotal: 5, deployedAt: "Apr 9, 2026 14:02 UTC",
  },
]

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
