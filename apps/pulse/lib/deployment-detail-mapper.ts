type DeploymentDetailRead = {
  id: string;
  environment?: string | null;
  deployed_at?: string | null;
  deployed_by?: string | null;
  metadata_json?: Record<string, unknown> | null;
  prompt_version?: { version?: string | null } | null;
  model_version?: { model_name?: string | null } | null;
  incident_ids?: string[] | null;
  events?: Array<{ id: string; event_type: string; created_at: string }> | null;
  intelligence?: {
    risk_score?: number | null;
    risk_explanations?: string[] | null;
    graph_risk_patterns?: Array<{ pattern: string; risk: string; trace_count: number }> | null;
    recommended_guardrails?: string[] | null;
  } | null;
  gate?: {
    decision: string;
    risk_score: number;
    explanations?: string[] | null;
    recommended_guardrails?: string[] | null;
    regression_risk?: { is_regression: boolean; reasons?: string[] | null } | null;
  } | null;
};

export type DeploymentDetailPresenter = {
  id: string;
  promptVersion: string | null;
  modelName: string | null;
  environment: string | null;
  deployedAt: string | null;
  deployedBy: string | null;
  metadata: Record<string, unknown> | null;
  gate: {
    decision: string;
    riskScore: number;
    explanations: string[];
    regression: { isRegression: boolean; reasons: string[] } | null;
  } | null;
  intelligence: {
    riskScore: number | null;
    riskExplanations: string[];
    graphRiskPatterns: Array<{ pattern: string; risk: string; traceCount: number }>;
    recommendedGuardrails: string[];
  } | null;
  incidentIds: string[];
  events: Array<{ id: string; eventType: string; createdAt: string }>;
};

export function mapDeploymentDetailPresenter(detail: DeploymentDetailRead): DeploymentDetailPresenter {
  return {
    id: detail.id,
    promptVersion: detail.prompt_version?.version ?? null,
    modelName: detail.model_version?.model_name ?? null,
    environment: detail.environment ?? null,
    deployedAt: detail.deployed_at ?? null,
    deployedBy: detail.deployed_by ?? null,
    metadata: detail.metadata_json ?? null,
    gate: detail.gate
      ? {
          decision: detail.gate.decision,
          riskScore: detail.gate.risk_score,
          explanations: detail.gate.explanations ?? [],
          regression: detail.gate.regression_risk
            ? {
                isRegression: detail.gate.regression_risk.is_regression,
                reasons: detail.gate.regression_risk.reasons ?? [],
              }
            : null,
        }
      : null,
    intelligence: detail.intelligence
      ? {
          riskScore: detail.intelligence.risk_score ?? null,
          riskExplanations: detail.intelligence.risk_explanations ?? [],
          graphRiskPatterns: (detail.intelligence.graph_risk_patterns ?? []).map((item) => ({
            pattern: item.pattern,
            risk: item.risk,
            traceCount: item.trace_count,
          })),
          recommendedGuardrails: detail.intelligence.recommended_guardrails ?? [],
        }
      : null,
    incidentIds: detail.incident_ids ?? [],
    events: (detail.events ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      createdAt: event.created_at,
    })),
  };
}
