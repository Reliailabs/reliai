import type { ReliaiTraceEvent } from "../tracing.ts";

function coerceBlocks(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      if ("text" in block && typeof block.text === "string") {
        return block.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function isAnthropicRequest(url: string): boolean {
  return /api\.anthropic\.com/i.test(url);
}

export function buildAnthropicTrace(input: {
  url: string;
  requestBody: unknown;
  responseBody: unknown;
  latencyMs: number;
  ok: boolean;
  framework?: string | null;
}): ReliaiTraceEvent | null {
  const requestBody = input.requestBody;
  if (!requestBody || typeof requestBody !== "object") {
    return null;
  }
  const model = "model" in requestBody && typeof requestBody.model === "string" ? requestBody.model : null;
  if (!model) {
    return null;
  }
  const prompt = Array.isArray((requestBody as { messages?: unknown[] }).messages)
    ? (requestBody as { messages: unknown[] }).messages
        .map((message) => {
          if (!message || typeof message !== "object") {
            return "";
          }
          const role = "role" in message && typeof message.role === "string" ? message.role : "message";
          const content = "content" in message ? coerceBlocks(message.content) : "";
          return content ? `${role}: ${content}` : "";
        })
        .filter(Boolean)
        .join("\n")
    : undefined;
  const responseBody = input.responseBody;
  const usage =
    responseBody && typeof responseBody === "object" && "usage" in responseBody && responseBody.usage
      ? responseBody.usage
      : null;
  return {
    model,
    provider: "anthropic",
    input: prompt,
    output:
      responseBody && typeof responseBody === "object" && "content" in responseBody
        ? coerceBlocks(responseBody.content) || null
        : null,
    latencyMs: input.latencyMs,
    promptTokens: usage && typeof usage === "object" && "input_tokens" in usage ? Number(usage.input_tokens) : undefined,
    completionTokens:
      usage && typeof usage === "object" && "output_tokens" in usage ? Number(usage.output_tokens) : undefined,
    success: input.ok,
    metadata: {
      auto_instrumented: true,
      span_type: "llm",
      framework: input.framework ?? undefined,
      provider_endpoint: input.url,
    },
  };
}
