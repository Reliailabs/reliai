// SLOs mock data for SLOs page
export const slos = [
  {
    id: "slo-001",
    name: "Refusal Rate",
    description: "Keep refusal rate below 2%",
    current: 1.2,
    target: 2.0,
    unit: "%",
    status: "healthy",
    trend: "down",
    project: "my-chatbot-prod",
    owner: "sarah@acme.io",
    period: "7d",
  },
  {
    id: "slo-002",
    name: "Latency (p95)",
    description: "p95 latency under 1200ms",
    current: 980,
    target: 1200,
    unit: "ms",
    status: "healthy",
    trend: "down",
    project: "legal-assistant",
    owner: "james@acme.io",
    period: "30d",
  },
  {
    id: "slo-003",
    name: "Hallucination Rate",
    description: "Keep hallucination rate below 1.5%",
    current: 2.1,
    target: 1.5,
    unit: "%",
    status: "breached",
    trend: "up",
    project: "my-chatbot-prod",
    owner: "ci-bot",
    period: "90d",
  },
  {
    id: "slo-004",
    name: "Retrieval Relevance",
    description: "Relevance score above 0.85",
    current: 0.81,
    target: 0.85,
    unit: "score",
    status: "at_risk",
    trend: "down",
    project: "rag-pipeline",
    owner: "alice@acme.com",
    period: "30d",
  },
];
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
    status: "live", gateStatus: "pass", riskScore: 67,
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

// ── Project detail ────────────────────────────────────────────────────────────

export interface ProjectDetail {
  id: string
  name: string
  env: string
  model: string
  errorRate: number      // percent
  p95Latency: number     // ms
  tracesPerDay: string
  openIncidents: number
}

export interface GuardrailPolicy {
  id: string
  name: string
  type: "refusal" | "pii" | "toxicity" | "latency" | "cost"
  enabled: boolean
  actionsLast24h: number
  threshold: string
  truePositives: number    // correctly blocked
  falsePositives: number   // incorrectly blocked (operators overrode)
}

export interface ReliabilityPattern {
  id: string
  pattern: string
  frequency: number      // occurrences
  severity: Severity
  lastSeen: string
}

export const projectDetails: Record<string, ProjectDetail> = {
  "cb2dfd2d": { id: "cb2dfd2d", name: "my-chatbot-prod", env: "production", model: "gpt-4o",            errorRate: 14.2, p95Latency: 1820, tracesPerDay: "12.4k", openIncidents: 2 },
  "ab3ce1ef": { id: "ab3ce1ef", name: "legal-assistant",  env: "production", model: "claude-3.5-sonnet", errorRate: 2.1,  p95Latency: 940,  tracesPerDay: "4.1k",  openIncidents: 1 },
  "dc7f2b01": { id: "dc7f2b01", name: "search-copilot",   env: "production", model: "gpt-4o",            errorRate: 3.7,  p95Latency: 680,  tracesPerDay: "8.7k",  openIncidents: 1 },
  "ef9a3c44": { id: "ef9a3c44", name: "data-extractor",   env: "production", model: "gpt-4o-mini",       errorRate: 0.8,  p95Latency: 320,  tracesPerDay: "2.3k",  openIncidents: 1 },
  "fa1b2d55": { id: "fa1b2d55", name: "rag-pipeline",     env: "staging",    model: "claude-3.5-sonnet", errorRate: 6.4,  p95Latency: 1240, tracesPerDay: "1.1k",  openIncidents: 1 },
}

export const guardrailPolicies: GuardrailPolicy[] = [
  { id: "g1", name: "PII Redaction",        type: "pii",      enabled: true,  actionsLast24h: 47,  threshold: "confidence > 0.85", truePositives: 44,  falsePositives: 3  },
  { id: "g2", name: "Refusal Detection",    type: "refusal",  enabled: true,  actionsLast24h: 234, threshold: "score > 0.7",       truePositives: 181, falsePositives: 53 },
  { id: "g3", name: "Toxicity Filter",      type: "toxicity", enabled: true,  actionsLast24h: 12,  threshold: "score > 0.9",       truePositives: 12,  falsePositives: 0  },
  { id: "g4", name: "Latency SLO",          type: "latency",  enabled: false, actionsLast24h: 0,   threshold: "p95 > 2000ms",      truePositives: 0,   falsePositives: 0  },
  { id: "g5", name: "Cost Per Request Cap", type: "cost",     enabled: false, actionsLast24h: 0,   threshold: "> $0.05",           truePositives: 0,   falsePositives: 0  },
]

export const reliabilityPatterns: ReliabilityPattern[] = [
  { id: "p1", pattern: "Refusal spike on ambiguous user intent",        frequency: 89,  severity: "high",     lastSeen: "14m ago" },
  { id: "p2", pattern: "max_tokens exceeded on long-document prompts",  frequency: 234, severity: "critical", lastSeen: "2m ago"  },
  { id: "p3", pattern: "Latency outliers correlated with gpt-4o calls", frequency: 41,  severity: "medium",   lastSeen: "1h ago"  },
  { id: "p4", pattern: "PII detected in 3% of legal_assistant traces",  frequency: 17,  severity: "high",     lastSeen: "3h ago"  },
  { id: "p5", pattern: "Consistent output truncation on RAG pipeline",  frequency: 62,  severity: "medium",   lastSeen: "30m ago" },
]

// ── Regressions ───────────────────────────────────────────────────────────────



export interface RegressionSnapshot {
  id: string
  name: string
  project: string
  promptVersion: string
  baselineVersion: string
  model: string
  metric: string
  baselineValue: number
  currentValue: number
  deltaPercent: number     // positive = worse
  severity: Severity
  status: "active" | "resolved"
  detectedAt: string
  sparkline: { value: number }[]   // 12 points
}

export const regressions: RegressionSnapshot[] = [
  {
    id: "r1", name: "Refusal rate regression",
    project: "my-chatbot-prod", promptVersion: "v2.1.4", baselineVersion: "v2.1.3",
    model: "gpt-4o", metric: "refusal_rate",
    baselineValue: 1.4, currentValue: 12.4, deltaPercent: 785,
    severity: "critical", status: "active", detectedAt: "14m ago",
    sparkline: [1.2,1.3,1.4,1.5,1.3,2.1,4.7,8.2,10.1,11.8,12.1,12.4].map(v => ({ value: v }))
  },
  {
    id: "r2", name: "p95 latency spike",
    project: "my-chatbot-prod", promptVersion: "v2.1.4", baselineVersion: "v2.1.3",
    model: "gpt-4o", metric: "p95_latency_ms",
    baselineValue: 1200, currentValue: 1820, deltaPercent: 52,
    severity: "high", status: "active", detectedAt: "14m ago",
    sparkline: [1180,1210,1200,1195,1220,1300,1450,1600,1720,1800,1810,1820].map(v => ({ value: v }))
  },
  {
    id: "r3", name: "Token usage increase",
    project: "legal-assistant", promptVersion: "v1.8.2", baselineVersion: "v1.8.1",
    model: "claude-3.5-sonnet", metric: "avg_tokens",
    baselineValue: 820, currentValue: 1240, deltaPercent: 51,
    severity: "high", status: "active", detectedAt: "2h ago",
    sparkline: [810,820,830,815,820,850,900,980,1080,1160,1220,1240].map(v => ({ value: v }))
  },
  {
    id: "r4", name: "Error rate uptick",
    project: "search-copilot", promptVersion: "v3.0.1", baselineVersion: "v3.0.0",
    model: "gpt-4o", metric: "error_rate",
    baselineValue: 0.8, currentValue: 3.7, deltaPercent: 363,
    severity: "medium", status: "active", detectedAt: "4h ago",
    sparkline: [0.7,0.8,0.9,0.8,0.8,1.1,1.5,2.0,2.8,3.2,3.5,3.7].map(v => ({ value: v }))
  },
  {
    id: "r5", name: "Refusal increase on staging",
    project: "rag-pipeline", promptVersion: "v0.4.3", baselineVersion: "v0.4.2",
    model: "claude-3.5-sonnet", metric: "refusal_rate",
    baselineValue: 2.1, currentValue: 6.4, deltaPercent: 205,
    severity: "medium", status: "active", detectedAt: "6h ago",
    sparkline: [2.0,2.1,2.2,2.1,2.3,2.8,3.4,4.0,4.8,5.5,6.0,6.4].map(v => ({ value: v }))
  },
  {
    id: "r6", name: "Latency regression (resolved)",
    project: "data-extractor", promptVersion: "v2.3.1", baselineVersion: "v2.3.0",
    model: "gpt-4o-mini", metric: "p95_latency_ms",
    baselineValue: 290, currentValue: 310, deltaPercent: 7,
    severity: "low", status: "resolved", detectedAt: "1d ago",
    sparkline: [285,290,295,300,310,320,315,310,305,300,295,310].map(v => ({ value: v }))
  },
  {
    id: "r7", name: "Token cost spike (resolved)",
    project: "search-copilot", promptVersion: "v2.9.8", baselineVersion: "v2.9.7",
    model: "gpt-4o", metric: "avg_tokens",
    baselineValue: 650, currentValue: 680, deltaPercent: 5,
    severity: "low", status: "resolved", detectedAt: "2d ago",
    sparkline: [645,650,660,670,680,685,680,675,670,665,660,680].map(v => ({ value: v }))
  },
]

// ── Deployments ──────────────────────────────────────────────────────────────

export type DeploymentStatus = "live" | "pending" | "failed" | "rolled_back"
export type GateStatus = "pass" | "fail" | "pending" | "skipped"

export interface RiskFactor {
  factor: string
  score: number
}

export interface DeploymentRecord {
  id: string
  name: string
  version: string
  project: string
  model: string
  status: DeploymentStatus
  gateStatus: GateStatus
  riskScore: number
  riskFactors: RiskFactor[]
  age: string
  triggeredBy: string
  commit: string
  baseline: string
  evalsPassed: number
  evalsTotal: number
  guardrailsPassed: number
  guardrailsTotal: number
  deployedAt: string
}


// ── Hourly error rate data ───────────────────────────────────────────────────

export const hourlyErrorRate: number[] = [
  12.4, 11.8, 13.2, 14.1, 15.3, 16.7, 18.2, 17.8, 16.4, 15.1, 14.2, 13.8,
  12.9, 11.5, 10.8, 9.7, 8.9, 8.1, 7.4, 6.8, 6.2, 5.9, 5.7, 5.4
]
