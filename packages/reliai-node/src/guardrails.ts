import { createHash } from "node:crypto";

import type { ReliaiClient } from "./client";

export type GuardrailAction = "block" | "retry" | "fallback_model" | "log_only";

export interface ReliaiGuardrailEvent {
  traceId: string;
  policyId: string;
  policy?: string;
  environment?: string;
  action: GuardrailAction;
  providerModel?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown> | null;
}

export interface GuardrailContext {
  client: ReliaiClient;
  policyId?: string;
  environment?: string;
  traceId?: string;
  spanId?: string | null;
  providerModel?: string;
}

export interface StructuredOutputOptions<T> extends GuardrailContext {
  schema: Record<string, unknown> | ((value: T) => boolean);
  run: () => Promise<T>;
  retryLimit?: number;
}

export interface LatencyRetryOptions<T> extends GuardrailContext {
  run: () => Promise<T>;
  maxLatencyMs: number;
  retryLimit?: number;
}

export interface CostBudgetOptions<T> extends GuardrailContext {
  run: () => Promise<T>;
  maxTokens?: number;
  maxCostUsd?: number;
}

function stablePolicyId(policy: string, config: Record<string, unknown>): string {
  const digest = createHash("sha1").update(`${policy}:${JSON.stringify(config)}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

function normalizeTraceContext(context: GuardrailContext, policy: string, config: Record<string, unknown>) {
  const active = context.client.currentSpanContext();
  return {
    traceId: context.traceId ?? active?.traceId ?? stablePolicyId("trace", { policy }),
    spanId: context.spanId ?? active?.spanId ?? null,
    policyId: context.policyId ?? stablePolicyId(policy, config),
  };
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function validateStructuredOutputValue<T>(schema: Record<string, unknown> | ((value: T) => boolean), value: T): boolean {
  if (typeof schema === "function") {
    return schema(value);
  }
  const candidate = coerceObject(value);
  if (!candidate) {
    return false;
  }
  for (const [key, expected] of Object.entries(schema)) {
    if (!(key in candidate)) {
      return false;
    }
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const nested = candidate[key];
      if (!validateStructuredOutputValue(expected as Record<string, unknown>, nested)) {
        return false;
      }
    }
  }
  return true;
}

async function emitGuardrailEvent(
  context: GuardrailContext,
  input: {
    policy: string;
    config: Record<string, unknown>;
    action: GuardrailAction;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const trace = normalizeTraceContext(context, input.policy, input.config);
  context.client.annotateCurrentSpan({
    guardrail_policy: input.policy,
    guardrail_action: input.action,
  });
  context.client.guardrailEvent({
    traceId: trace.traceId,
    policyId: trace.policyId,
    policy: input.policy,
    environment: context.environment,
    action: input.action,
    providerModel: context.providerModel,
    latencyMs: input.latencyMs,
    metadata: {
      span_id: trace.spanId,
      timestamp: new Date().toISOString(),
      ...(input.metadata ?? {}),
    },
  });
}

export async function structuredOutput<T>(options: StructuredOutputOptions<T>): Promise<T> {
  const retryLimit = options.retryLimit ?? Number(process.env.RELIAI_GUARDRAIL_RETRY_LIMIT ?? "1");
  let attempts = 0;
  while (true) {
    const result = await options.run();
    if (validateStructuredOutputValue(options.schema, result)) {
      return result;
    }
    await emitGuardrailEvent(options, {
      policy: "structured_output",
      config: { schema: options.schema, retry_limit: retryLimit },
      action: "retry",
      metadata: { attempt: attempts + 1, reason: "invalid_structured_output" },
    });
    if (attempts >= retryLimit) {
      return result;
    }
    attempts += 1;
  }
}

export async function latencyRetry<T>(options: LatencyRetryOptions<T>): Promise<T> {
  const retryLimit = options.retryLimit ?? Number(process.env.RELIAI_GUARDRAIL_RETRY_LIMIT ?? "1");
  let attempts = 0;
  while (true) {
    const startedAt = Date.now();
    const result = await options.run();
    const latencyMs = Date.now() - startedAt;
    if (latencyMs <= options.maxLatencyMs || attempts >= retryLimit) {
      return result;
    }
    await emitGuardrailEvent(options, {
      policy: "latency_retry",
      config: { max_latency_ms: options.maxLatencyMs, retry_limit: retryLimit },
      action: "retry",
      latencyMs,
      metadata: { attempt: attempts + 1, reason: "latency_threshold_exceeded" },
    });
    attempts += 1;
  }
}

export async function costBudget<T>(options: CostBudgetOptions<T>): Promise<T> {
  const result = await options.run();
  const candidate = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const promptTokens = Number(candidate.prompt_tokens ?? candidate.promptTokens ?? 0);
  const completionTokens = Number(candidate.completion_tokens ?? candidate.completionTokens ?? 0);
  const totalTokens = promptTokens + completionTokens;
  const totalCostUsd = Number(candidate.total_cost_usd ?? candidate.totalCostUsd ?? 0);

  const overTokens = options.maxTokens != null && totalTokens > options.maxTokens;
  const overCost = options.maxCostUsd != null && totalCostUsd > options.maxCostUsd;
  if (!overTokens && !overCost) {
    return result;
  }

  await emitGuardrailEvent(options, {
    policy: "cost_budget",
    config: { max_tokens: options.maxTokens, max_cost_usd: options.maxCostUsd },
    action: "block",
    metadata: {
      reason: "cost_budget_exceeded",
      observed_tokens: totalTokens,
      observed_cost_usd: totalCostUsd,
    },
  });
  throw new Error("Reliai cost budget guardrail blocked execution");
}
