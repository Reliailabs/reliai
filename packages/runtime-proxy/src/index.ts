export type GuardrailAction = "block" | "retry" | "fallback_model" | "log_only";

export interface GuardrailDecision {
  triggered: boolean;
  actionTaken: GuardrailAction | null;
  metadata: Record<string, unknown> | null;
}

export interface RuntimeGuardrailPolicy {
  id: string;
  policyType: "structured_output" | "hallucination" | "cost_budget" | "latency_retry";
  configJson: Record<string, unknown>;
  isActive?: boolean;
}

export interface RuntimeProviderRequest {
  projectId: string;
  model: string;
  prompt: string;
  metadata?: Record<string, unknown> | null;
  retrievalSourceCount?: number | null;
}

export interface RuntimeProviderResponse {
  model: string;
  outputText: string | null;
  success: boolean;
  errorType?: string | null;
  latencyMs?: number | null;
  totalCostUsd?: number | string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RuntimeEventRecorderInput {
  traceId: string;
  policyId: string;
  actionTaken: GuardrailAction;
  providerModel: string | null;
  latencyMs: number | null;
  metadata: Record<string, unknown> | null;
}

export interface RuntimeExecutionDecision {
  policyId: string;
  policyType: string;
  actionTaken: GuardrailAction;
  metadata: Record<string, unknown> | null;
}

export interface RuntimeExecutionResult {
  response: RuntimeProviderResponse | null;
  blocked: boolean;
  decisions: RuntimeExecutionDecision[];
}

export interface ExecuteLlmRequestOptions {
  traceId: string;
  request: RuntimeProviderRequest;
  policies?: RuntimeGuardrailPolicy[];
  loadPolicies?: (projectId: string) => Promise<RuntimeGuardrailPolicy[]>;
  providerExecutor: (request: RuntimeProviderRequest) => Promise<RuntimeProviderResponse>;
  recordEvent?: (input: RuntimeEventRecorderInput) => Promise<void>;
}

function normalizeConfig<T extends Record<string, unknown>>(config: Record<string, unknown>): T {
  return config as T;
}

function shouldEvaluate(policy: RuntimeGuardrailPolicy): boolean {
  return policy.isActive !== false;
}

function validateStructuredOutput(
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

function detectHallucination(input: {
  metadata?: Record<string, unknown> | null;
  retrievalSourceCount?: number | null;
  config: { action: GuardrailAction; requireRetrieval?: boolean };
}): GuardrailDecision {
  const metadata = input.metadata ?? {};
  const reasons: string[] = [];
  if (metadata["hallucination_detected"] === true) reasons.push("metadata_flagged_hallucination");
  if (metadata["grounded"] === false) reasons.push("metadata_grounded_false");
  if (input.config.requireRetrieval && (input.retrievalSourceCount ?? 0) <= 0) {
    reasons.push("missing_retrieval_support");
  }
  return reasons.length
    ? { triggered: true, actionTaken: input.config.action, metadata: { reasons } }
    : { triggered: false, actionTaken: null, metadata: null };
}

function enforceCostBudget(
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

function latencyRetryPolicy(
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

export function executeProviderRequest(
  request: RuntimeProviderRequest,
  providerExecutor: (request: RuntimeProviderRequest) => Promise<RuntimeProviderResponse>,
): Promise<RuntimeProviderResponse> {
  return providerExecutor(request);
}

export function applyGuardrails(input: {
  request: RuntimeProviderRequest;
  response: RuntimeProviderResponse;
  policies: RuntimeGuardrailPolicy[];
}): RuntimeExecutionDecision[] {
  const decisions: RuntimeExecutionDecision[] = [];
  for (const policy of input.policies) {
    if (!shouldEvaluate(policy)) continue;
    let decision: GuardrailDecision;
    if (policy.policyType === "structured_output") {
      decision = validateStructuredOutput(
        input.response.outputText,
        normalizeConfig<{ action: GuardrailAction; requireJson?: boolean }>(policy.configJson),
      );
    } else if (policy.policyType === "hallucination") {
      decision = detectHallucination({
        metadata: input.response.metadata ?? input.request.metadata ?? null,
        retrievalSourceCount: input.request.retrievalSourceCount ?? null,
        config: normalizeConfig<{ action: GuardrailAction; requireRetrieval?: boolean }>(policy.configJson),
      });
    } else if (policy.policyType === "cost_budget") {
      decision = enforceCostBudget(
        input.response.totalCostUsd,
        normalizeConfig<{ action: GuardrailAction; maxCostUsd: number | string }>(policy.configJson),
      );
    } else {
      decision = latencyRetryPolicy(
        input.response.latencyMs,
        normalizeConfig<{ action: GuardrailAction; maxLatencyMs: number; fallbackModel?: string | null }>(
          policy.configJson,
        ),
      );
    }
    if (!decision.triggered || !decision.actionTaken) continue;
    decisions.push({
      policyId: policy.id,
      policyType: policy.policyType,
      actionTaken: decision.actionTaken,
      metadata: decision.metadata,
    });
  }
  return decisions;
}

export async function executeLlmRequest(options: ExecuteLlmRequestOptions): Promise<RuntimeExecutionResult> {
  const policies = options.policies ?? (options.loadPolicies ? await options.loadPolicies(options.request.projectId) : []);
  let request = { ...options.request };
  let response = await executeProviderRequest(request, options.providerExecutor);
  const decisions: RuntimeExecutionDecision[] = [];

  for (const decision of applyGuardrails({
    request,
    response,
    policies,
  })) {
    decisions.push(decision);
    if (options.recordEvent) {
      await options.recordEvent({
        traceId: options.traceId,
        policyId: decision.policyId,
        actionTaken: decision.actionTaken,
        providerModel: response.model ?? request.model,
        latencyMs: response.latencyMs ?? null,
        metadata: decision.metadata,
      });
    }
    if (decision.actionTaken === "log_only") {
      continue;
    }
    if (decision.actionTaken === "block") {
      return { response: null, blocked: true, decisions };
    }
    if (decision.actionTaken === "retry") {
      response = await executeProviderRequest(request, options.providerExecutor);
      continue;
    }
    if (decision.actionTaken === "fallback_model") {
      const fallbackModel =
        typeof decision.metadata?.fallback_model === "string"
          ? decision.metadata.fallback_model
          : typeof policies.find((policy) => policy.id === decision.policyId)?.configJson["fallback_model"] ===
              "string"
            ? String(policies.find((policy) => policy.id === decision.policyId)?.configJson["fallback_model"])
            : null;
      if (fallbackModel) {
        request = { ...request, model: fallbackModel };
        response = await executeProviderRequest(request, options.providerExecutor);
      }
    }
  }

  return { response, blocked: false, decisions };
}
