import type { ReliaiTraceEvent } from "../tracing.ts";

function coerceMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractPrompt(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) {
    return undefined;
  }
  const lines = messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }
      const role = "role" in message && typeof message.role === "string" ? message.role : "message";
      const content = "content" in message ? coerceMessageContent(message.content) : "";
      if (!content) {
        return null;
      }
      return `${role}: ${content}`;
    })
    .filter((value): value is string => Boolean(value));
  return lines.length ? lines.join("\n") : undefined;
}

function extractOutput(choice: unknown): string | null {
  if (!choice || typeof choice !== "object") {
    return null;
  }
  if ("message" in choice && choice.message && typeof choice.message === "object" && "content" in choice.message) {
    return coerceMessageContent(choice.message.content) || null;
  }
  if ("text" in choice && typeof choice.text === "string") {
    return choice.text;
  }
  return null;
}

export function isOpenAIRequest(url: string): boolean {
  return /api\.openai\.com/i.test(url);
}

export function buildOpenAITrace(input: {
  url: string;
  requestBody: unknown;
  responseBody: unknown;
  latencyMs: number;
  ok: boolean;
  framework?: string | null;
}): ReliaiTraceEvent | null {
  const requestBody = input.requestBody;
  const responseBody = input.responseBody;
  if (!requestBody || typeof requestBody !== "object") {
    return null;
  }
  const model = "model" in requestBody && typeof requestBody.model === "string" ? requestBody.model : null;
  if (!model) {
    return null;
  }
  const prompt = extractPrompt("messages" in requestBody ? requestBody.messages : undefined);
  const output =
    responseBody &&
    typeof responseBody === "object" &&
    "choices" in responseBody &&
    Array.isArray(responseBody.choices)
      ? extractOutput(responseBody.choices[0])
      : null;
  const usage =
    responseBody && typeof responseBody === "object" && "usage" in responseBody && responseBody.usage
      ? responseBody.usage
      : null;
  return {
    model,
    provider: "openai",
    input: prompt,
    output,
    latencyMs: input.latencyMs,
    promptTokens: usage && typeof usage === "object" && "prompt_tokens" in usage ? Number(usage.prompt_tokens) : undefined,
    completionTokens:
      usage && typeof usage === "object" && "completion_tokens" in usage ? Number(usage.completion_tokens) : undefined,
    success: input.ok,
    metadata: {
      auto_instrumented: true,
      span_type: "llm",
      framework: input.framework ?? undefined,
      provider_endpoint: input.url,
    },
  };
}
