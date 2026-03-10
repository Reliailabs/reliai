export type GuardrailAction = "block" | "retry" | "fallback_model" | "log_only";

export interface GuardrailDecision {
  triggered: boolean;
  actionTaken: GuardrailAction | null;
  metadata: Record<string, unknown> | null;
}

export interface ReliaiLlmRequest {
  projectId: string;
  traceId: string;
  environment?: string;
  model: string;
  prompt: string;
  guardrailPolicies?: {
    id: string;
    policyType: "structured_output" | "hallucination" | "cost_budget" | "latency_retry";
    configJson: Record<string, unknown>;
    isActive?: boolean;
  }[];
  loadPolicies?: (projectId: string) => Promise<{
    id: string;
    policyType: "structured_output" | "hallucination" | "cost_budget" | "latency_retry";
    configJson: Record<string, unknown>;
    isActive?: boolean;
  }[]>;
  providerExecutor: (request: {
    projectId: string;
    model: string;
    prompt: string;
    metadata?: Record<string, unknown> | null;
    retrievalSourceCount?: number | null;
  }) => Promise<{
    model: string;
    outputText: string | null;
    success: boolean;
    errorType?: string | null;
    latencyMs?: number | null;
    totalCostUsd?: number | string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  recordEvent?: (input: {
    traceId: string;
    policyId: string;
    actionTaken: GuardrailAction;
    providerModel: string | null;
    latencyMs: number | null;
    metadata: Record<string, unknown> | null;
  }) => Promise<void>;
  metadata?: Record<string, unknown> | null;
  retrievalSourceCount?: number | null;
  reliaiApiBaseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

const POLICY_CACHE_TTL_MS = 60_000;
const policyCache = new Map<string, { expiresAt: number; policies: ReliaiLlmRequest["guardrailPolicies"] }>();

export function clearReliaiGuardrailPolicyCache() {
  policyCache.clear();
}

async function fetchRuntimeGuardrailPolicies(input: {
  projectId: string;
  environment?: string;
  reliaiApiBaseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.reliaiApiBaseUrl.replace(/\/$/, "");
  const cacheKey = `${baseUrl}:${input.projectId}:${input.environment ?? "production"}`;
  const now = Date.now();
  const cached = policyCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.policies ?? [];
  }
  const fetcher = input.fetchImpl ?? fetch;
  const params = new URLSearchParams();
  if (input.environment) {
    params.set("environment", input.environment);
  }
  const response = await fetcher(
    `${baseUrl}/api/v1/runtime/guardrails${params.toString() ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      headers: {
        "X-API-Key": input.apiKey,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load runtime guardrails: ${response.status}`);
  }
  const payload = (await response.json()) as {
    policies: Array<{
      id: string;
      policy_type: "structured_output" | "hallucination" | "cost_budget" | "latency_retry";
      action: GuardrailAction;
      config: Record<string, unknown>;
    }>;
  };
  const policies = payload.policies.map((policy) => ({
    id: policy.id,
    policyType: policy.policy_type,
    configJson: {
      action: policy.action,
      ...policy.config,
    },
    isActive: true,
  }));
  policyCache.set(cacheKey, {
    expiresAt: now + POLICY_CACHE_TTL_MS,
    policies,
  });
  return policies;
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

export async function reliaiLLM(input: ReliaiLlmRequest) {
  const { executeLlmRequest } = await import("../../runtime-proxy/src/index.ts");
  const loadPolicies =
    input.loadPolicies ??
    (input.guardrailPolicies == null && input.reliaiApiBaseUrl && input.apiKey
      ? (projectId: string) =>
          fetchRuntimeGuardrailPolicies({
            projectId,
            environment: input.environment,
            reliaiApiBaseUrl: input.reliaiApiBaseUrl as string,
            apiKey: input.apiKey as string,
            fetchImpl: input.fetchImpl,
          })
      : undefined);
  return executeLlmRequest({
    traceId: input.traceId,
    request: {
      projectId: input.projectId,
      environment: input.environment,
      model: input.model,
      prompt: input.prompt,
      metadata: input.metadata,
      retrievalSourceCount: input.retrievalSourceCount,
    },
    policies: input.guardrailPolicies,
    loadPolicies,
    providerExecutor: input.providerExecutor,
    recordEvent: input.recordEvent,
  });
}
