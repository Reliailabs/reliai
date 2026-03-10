export type GuardrailAction = "block" | "retry" | "fallback_model" | "log_only";

export interface GuardrailDecision {
  triggered: boolean;
  actionTaken: GuardrailAction | null;
  metadata: Record<string, unknown> | null;
}

export function validateStructuredOutput(
  outputText: string | null | undefined,
  config: { action: GuardrailAction; requireJson?: boolean },
): GuardrailDecision {
  if (config.requireJson === false) {
    return { triggered: false, actionTaken: null, metadata: null };
  }
  try {
    JSON.parse(outputText ?? "");
    return { triggered: false, actionTaken: null, metadata: null };
  } catch {
    return { triggered: true, actionTaken: config.action, metadata: { reason: "invalid_json_output" } };
  }
}

export function detectHallucination(input: {
  metadata?: Record<string, unknown> | null;
  retrievalSourceCount?: number | null;
  config: { action: GuardrailAction; requireRetrieval?: boolean };
}): GuardrailDecision {
  const metadata = input.metadata ?? {};
  const reasons: string[] = [];
  if (metadata["hallucination_detected"] === true) reasons.push("metadata_flagged_hallucination");
  if (metadata["grounded"] === false) reasons.push("metadata_grounded_false");
  if (input.config.requireRetrieval && (input.retrievalSourceCount ?? 0) <= 0) reasons.push("missing_retrieval_support");
  return reasons.length
    ? { triggered: true, actionTaken: input.config.action, metadata: { reasons } }
    : { triggered: false, actionTaken: null, metadata: null };
}

export function enforceCostBudget(
  totalCostUsd: number | string | null | undefined,
  config: { action: GuardrailAction; maxCostUsd: number | string },
): GuardrailDecision {
  if (totalCostUsd == null || Number(totalCostUsd) <= Number(config.maxCostUsd)) {
    return { triggered: false, actionTaken: null, metadata: null };
  }
  return {
    triggered: true,
    actionTaken: config.action,
    metadata: { max_cost_usd: String(config.maxCostUsd), observed_cost_usd: String(totalCostUsd) },
  };
}

export function latencyRetryPolicy(
  latencyMs: number | null | undefined,
  config: { action: GuardrailAction; maxLatencyMs: number; fallbackModel?: string | null },
): GuardrailDecision {
  if (latencyMs == null || latencyMs <= config.maxLatencyMs) {
    return { triggered: false, actionTaken: null, metadata: null };
  }
  return {
    triggered: true,
    actionTaken: config.action,
    metadata: {
      max_latency_ms: config.maxLatencyMs,
      observed_latency_ms: latencyMs,
      fallback_model: config.fallbackModel ?? null,
    },
  };
}
