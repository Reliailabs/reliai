import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import type { ReliaiGuardrailEvent } from "./guardrails";
import type { ReliaiTraceEvent } from "./tracing";

type EventEnvelope =
  | { kind: "trace"; payload: ReliaiTraceEvent }
  | { kind: "guardrail"; payload: ReliaiGuardrailEvent };

export interface ReliaiClientOptions {
  apiKey?: string;
  endpoint?: string;
  environment?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  fetchImpl?: typeof fetch;
  onError?: (error: Error) => void;
}

export interface ReliaiSpanScope {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  setMetadata: (metadata: Record<string, unknown>) => void;
  setTraceFields: (fields: Partial<ReliaiTraceEvent>) => void;
}

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  spanName: string;
  annotations: Record<string, unknown>;
}

function coerceTimestamp(timestamp?: Date | string): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date(timestamp).toISOString();
}

export class ReliaiClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly environment?: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly onError?: (error: Error) => void;
  private readonly spanStorage = new AsyncLocalStorage<SpanContext>();
  private readonly queue: EventEnvelope[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(options: ReliaiClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.RELIAI_API_KEY ?? "";
    this.endpoint = (options.endpoint ?? process.env.RELIAI_ENDPOINT ?? "https://api.reliai.ai").replace(/\/$/, "");
    this.environment = options.environment ?? process.env.RELIAI_ENVIRONMENT;
    this.batchSize = options.batchSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 2_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onError = options.onError;

    if (!this.apiKey) {
      throw new Error("ReliaiClient requires apiKey or RELIAI_API_KEY");
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.flushTimer.unref?.();
  }

  trace(event: ReliaiTraceEvent): void {
    this.queue.push({ kind: "trace", payload: event });
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  guardrailEvent(event: ReliaiGuardrailEvent): void {
    this.queue.push({ kind: "guardrail", payload: event });
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }
    const batch = this.queue.splice(0, this.batchSize);
    if (!batch.length) {
      return;
    }
    this.flushPromise = this.flushBatch(batch).finally(() => {
      this.flushPromise = null;
      if (this.queue.length) {
        void this.flush();
      }
    });
    return this.flushPromise;
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.endpoint}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Reliai request failed (${response.status}): ${body}`);
    }
    return response.json() as Promise<T>;
  }

  currentSpanContext(): { traceId: string; spanId: string; parentSpanId: string | null } | null {
    const context = this.spanStorage.getStore();
    if (!context) {
      return null;
    }
    return {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
    };
  }

  propagationHeaders(): Record<string, string> {
    const context = this.currentSpanContext();
    if (!context) {
      return {};
    }
    return {
      "x-reliai-trace-id": context.traceId,
      "x-reliai-parent-span-id": context.spanId,
    };
  }

  annotateCurrentSpan(metadata: Record<string, unknown>): void {
    const context = this.spanStorage.getStore();
    if (!context) {
      return;
    }
    Object.assign(context.annotations, metadata);
  }

  async span<T>(
    name: string,
    fn: (scope: ReliaiSpanScope) => Promise<T> | T,
    metadata: Record<string, unknown> = {},
  ): Promise<T> {
    const parent = this.spanStorage.getStore();
    const context: SpanContext = {
      traceId: parent?.traceId ?? randomUUID(),
      spanId: randomUUID(),
      parentSpanId: parent?.spanId ?? null,
      spanName: name,
      annotations: {},
    };
    const startedAt = new Date();
    const spanMetadata: Record<string, unknown> = { ...metadata };
    const traceFields: Partial<ReliaiTraceEvent> = {};
    const scope: ReliaiSpanScope = {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      setMetadata: (nextMetadata) => Object.assign(spanMetadata, nextMetadata),
      setTraceFields: (fields) => Object.assign(traceFields, fields),
    };

    try {
      const result = await this.spanStorage.run(context, async () => await fn(scope));
      this.emitSpanTrace({
        context,
        startedAt,
        metadata: spanMetadata,
        traceFields,
        success: true,
      });
      return result;
    } catch (error) {
      this.emitSpanTrace({
        context,
        startedAt,
        metadata: spanMetadata,
        traceFields,
        success: false,
        errorType: error instanceof Error ? error.name : "span_error",
      });
      throw error;
    }
  }

  private async flushBatch(batch: EventEnvelope[]): Promise<void> {
    const requests = batch.map((entry) => this.dispatch(entry));
    const results = await Promise.allSettled(requests);
    for (const result of results) {
      if (result.status === "rejected") {
        this.onError?.(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
      }
    }
  }

  private async dispatch(entry: EventEnvelope): Promise<void> {
    if (entry.kind === "trace") {
      await this.post("/api/v1/ingest/traces", {
        timestamp: coerceTimestamp(entry.payload.timestamp),
        request_id: entry.payload.requestId ?? entry.payload.spanId ?? randomUUID(),
        environment: entry.payload.environment ?? this.environment,
        user_id: entry.payload.userId,
        session_id: entry.payload.sessionId,
        model_name: entry.payload.model,
        model_provider: entry.payload.provider,
        prompt_version: entry.payload.promptVersion,
        input_text: entry.payload.input,
        output_text: entry.payload.output,
        latency_ms: entry.payload.latencyMs ?? entry.payload.durationMs,
        prompt_tokens: entry.payload.promptTokens,
        completion_tokens: entry.payload.completionTokens,
        total_cost_usd: entry.payload.totalCostUsd,
        success: entry.payload.success ?? true,
        error_type: entry.payload.errorType,
        metadata_json: {
          ...(entry.payload.metadata ?? {}),
          ...(entry.payload.traceId
            ? {
                reliai_trace_id: entry.payload.traceId,
                reliai_span_id: entry.payload.spanId,
                reliai_parent_span_id: entry.payload.parentSpanId,
                span_name: entry.payload.spanName,
                span_start_time: coerceTimestamp(entry.payload.startTime ?? entry.payload.timestamp),
                span_duration_ms: entry.payload.durationMs ?? entry.payload.latencyMs,
              }
            : {}),
        },
        retrieval: entry.payload.retrieval
          ? {
              retrieval_latency_ms: entry.payload.retrieval.retrievalLatencyMs,
              source_count: entry.payload.retrieval.sourceCount,
              top_k: entry.payload.retrieval.topK,
              query_text: entry.payload.retrieval.queryText,
              retrieved_chunks_json: entry.payload.retrieval.retrievedChunks,
            }
          : undefined,
      });
      return;
    }

    await this.post("/api/v1/runtime/guardrail-events", {
      trace_id: entry.payload.traceId,
      policy_id: entry.payload.policyId,
      environment: entry.payload.environment ?? this.environment,
      action_taken: entry.payload.action,
      provider_model: entry.payload.providerModel,
      latency_ms: entry.payload.latencyMs,
      metadata_json: entry.payload.policy
        ? {
            policy: entry.payload.policy,
            ...(entry.payload.metadata ?? {}),
          }
        : (entry.payload.metadata ?? undefined),
    });
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<void> {
    await this.requestJson(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  private emitSpanTrace(input: {
    context: SpanContext;
    startedAt: Date;
    metadata: Record<string, unknown>;
    traceFields: Partial<ReliaiTraceEvent>;
    success: boolean;
    errorType?: string;
  }): void {
    const durationMs = Date.now() - input.startedAt.getTime();
    this.trace({
      model:
        typeof input.traceFields.model === "string" && input.traceFields.model.length
          ? input.traceFields.model
          : "span",
      provider:
        typeof input.traceFields.provider === "string" && input.traceFields.provider.length
          ? input.traceFields.provider
          : "reliai",
      input: input.traceFields.input,
      output: input.traceFields.output,
      promptVersion: input.traceFields.promptVersion,
      promptTokens: input.traceFields.promptTokens,
      completionTokens: input.traceFields.completionTokens,
      totalCostUsd: input.traceFields.totalCostUsd,
      environment: input.traceFields.environment ?? this.environment,
      requestId: input.context.spanId,
      traceId: input.context.traceId,
      spanId: input.context.spanId,
      parentSpanId: input.context.parentSpanId,
      spanName: input.context.spanName,
      startTime: input.startedAt,
      timestamp: input.startedAt,
      durationMs,
      latencyMs: input.traceFields.latencyMs ?? durationMs,
      success: input.success,
      errorType: input.errorType,
      metadata: {
        ...input.metadata,
        ...input.context.annotations,
      },
      retrieval: input.traceFields.retrieval,
    });
  }
}

let defaultClient: ReliaiClient | null = null;

export function getDefaultClient(options: ReliaiClientOptions = {}): ReliaiClient {
  if (!defaultClient) {
    defaultClient = new ReliaiClient(options);
  }
  return defaultClient;
}

export function span<T>(
  name: string,
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: Record<string, unknown> = {},
): Promise<T> {
  return getDefaultClient().span(name, fn, metadata);
}
