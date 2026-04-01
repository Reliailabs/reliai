import { ReliaiClient, type ReliaiClientOptions } from "./client";
import { costBudget, latencyRetry, structuredOutput } from "./guardrails";
import { buildAnthropicTrace, isAnthropicRequest } from "./instrumentation/anthropic";
import { detectFrameworkFromHeaders, instrumentLangChain } from "./instrumentation/langchain";
import { instrumentLlamaIndex } from "./instrumentation/llamaindex";
import { buildOpenAITrace, isOpenAIRequest } from "./instrumentation/openai";

let autoClient: ReliaiClient | null = null;
let originalFetch: typeof fetch | null = null;

export interface ReliaiAutoInstrumentationOptions extends ReliaiClientOptions {
  guardrails?: boolean;
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  if (init?.body && typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return null;
    }
  }
  if (input instanceof Request) {
    const cloned = input.clone();
    try {
      return JSON.parse(await cloned.text());
    } catch {
      return null;
    }
  }
  return null;
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers | Record<string, string> | string[][] | null {
  if (init?.headers) {
    return init.headers as Headers | Record<string, string> | string[][];
  }
  if (input instanceof Request) {
    return input.headers;
  }
  return null;
}

function mergeHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  reliaiHeaders: Record<string, string>,
): RequestInit | undefined {
  if (!Object.keys(reliaiHeaders).length) {
    return init;
  }
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  for (const [key, value] of Object.entries(reliaiHeaders)) {
    headers.set(key, value);
  }
  return {
    ...(init ?? {}),
    headers,
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function guardrailsEnabled(options: ReliaiAutoInstrumentationOptions): boolean {
  if (typeof options.guardrails === "boolean") {
    return options.guardrails;
  }
  return process.env.RELIAI_GUARDRAILS_ENABLED === "true";
}

function shouldRequireStructuredOutput(requestBody: unknown): boolean {
  if (!requestBody || typeof requestBody !== "object") {
    return false;
  }
  const responseFormat = (requestBody as Record<string, unknown>).response_format;
  if (responseFormat && typeof responseFormat === "object" && "type" in responseFormat) {
    const value = (responseFormat as Record<string, unknown>).type;
    return typeof value === "string" && value.includes("json");
  }
  return false;
}

export function enableAutoInstrumentation(options: ReliaiAutoInstrumentationOptions = {}): ReliaiClient | null {
  if (originalFetch) {
    return autoClient;
  }
  const apiKey = options.apiKey ?? process.env.RELIAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  autoClient = new ReliaiClient({ ...options, apiKey });
  void instrumentLangChain(autoClient);
  void instrumentLlamaIndex(autoClient);
  originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isOpenAIRequest(url) && !isAnthropicRequest(url)) {
      return originalFetch!(input, init);
    }

    return autoClient!.span(
      "llm_call",
      async (scope) => {
        const nextInit = mergeHeaders(input, init, autoClient!.propagationHeaders());
        const requestBody = await readRequestBody(input, nextInit);
        const runFetch = async () => {
          const startedAt = Date.now();
          const response = await originalFetch!(input, nextInit);
          const responseBody = await readResponseBody(response);
          const headers = requestHeaders(input, nextInit);
          const framework = headers ? detectFrameworkFromHeaders(headers) : null;
          const trace = isOpenAIRequest(url)
            ? buildOpenAITrace({
                url,
                requestBody,
                responseBody,
                latencyMs: Date.now() - startedAt,
                ok: response.ok,
                framework,
              })
            : buildAnthropicTrace({
                url,
                requestBody,
                responseBody,
                latencyMs: Date.now() - startedAt,
                ok: response.ok,
                framework,
              });
          return { response, trace };
        };

        const withLatencyGuard = async () =>
          latencyRetry({
            client: autoClient!,
            traceId: scope.traceId,
            spanId: scope.spanId,
            maxLatencyMs: Number(process.env.RELIAI_GUARDRAIL_MAX_LATENCY_MS ?? "5000"),
            retryLimit: Number(process.env.RELIAI_GUARDRAIL_RETRY_LIMIT ?? "1"),
            run: runFetch,
          });

        const guardedFetch = async () => (guardrailsEnabled(options) ? await withLatencyGuard() : await runFetch());
        let result = await guardedFetch();
        if (guardrailsEnabled(options) && shouldRequireStructuredOutput(requestBody)) {
          result = await structuredOutput({
            client: autoClient!,
            traceId: scope.traceId,
            spanId: scope.spanId,
            schema: (value) => Boolean(value && value.trace?.output && (() => {
              try {
                JSON.parse(String(value.trace.output));
                return true;
              } catch {
                return false;
              }
            })()),
            retryLimit: Number(process.env.RELIAI_GUARDRAIL_RETRY_LIMIT ?? "1"),
            run: guardedFetch,
          });
        }
        if (guardrailsEnabled(options)) {
          await costBudget({
            client: autoClient!,
            traceId: scope.traceId,
            spanId: scope.spanId,
            maxTokens: process.env.RELIAI_GUARDRAIL_MAX_TOKENS ? Number(process.env.RELIAI_GUARDRAIL_MAX_TOKENS) : undefined,
            maxCostUsd: process.env.RELIAI_GUARDRAIL_MAX_COST_USD ? Number(process.env.RELIAI_GUARDRAIL_MAX_COST_USD) : undefined,
            run: async () => ({
              promptTokens: result.trace?.promptTokens,
              completionTokens: result.trace?.completionTokens,
              totalCostUsd: result.trace?.totalCostUsd,
            }),
          }).catch(() => undefined);
        }

        if (result.trace) {
          scope.setTraceFields({
            ...result.trace,
            metadata: {
              ...(result.trace.metadata ?? {}),
              guardrails_enabled: guardrailsEnabled(options),
            },
          });
          scope.setMetadata({
            ...(result.trace.metadata ?? {}),
            reliai_trace_id: scope.traceId,
            reliai_span_id: scope.spanId,
            reliai_parent_span_id: scope.parentSpanId,
          });
        }

        return result.response;
      },
      { auto_instrumented: true, provider_url: url, span_type: "llm" },
    );
  };
  return autoClient;
}

export async function disableAutoInstrumentation(): Promise<void> {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  if (autoClient) {
    await autoClient.shutdown();
    autoClient = null;
  }
}

enableAutoInstrumentation();
