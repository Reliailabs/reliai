import type { ReliaiClient } from "../client.ts";

function getHeader(headers: Headers | Record<string, string> | string[][], key: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(key);
  }
  if (Array.isArray(headers)) {
    const match = headers.find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
    return match?.[1] ?? null;
  }
  const direct = headers[key] ?? headers[key.toLowerCase()];
  return typeof direct === "string" ? direct : null;
}

export function detectFrameworkFromHeaders(headers: Headers | Record<string, string> | string[][]): string | null {
  const userAgent = getHeader(headers, "user-agent") ?? getHeader(headers, "x-stainless-user-agent") ?? "";
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("langchain")) {
    return "langchain";
  }
  if (normalized.includes("llamaindex")) {
    return "llamaindex";
  }
  return null;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

function patchMethod(
  target: Record<string, unknown>,
  methodName: string,
  wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown,
): void {
  const original = target[methodName];
  if (!isFunction(original) || (original as { __reliai_patched__?: boolean }).__reliai_patched__) {
    return;
  }
  const patched = wrap(original);
  (patched as { __reliai_patched__?: boolean }).__reliai_patched__ = true;
  target[methodName] = patched;
}

async function patchLangChainModule(
  client: ReliaiClient,
  moduleName: string,
): Promise<void> {
  try {
    const imported = await import(moduleName);
    const candidates = Object.values(imported).filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "function");
    for (const candidate of candidates) {
      const prototype = candidate.prototype as Record<string, unknown> | undefined;
      if (!prototype) {
        continue;
      }
      patchMethod(prototype, "run", (original) => function patchedRun(this: unknown, ...args: unknown[]) {
        return client.span("llm_call", () => original.apply(this, args), {
          span_type: "llm",
          framework: "langchain",
        });
      });
      patchMethod(prototype, "getRelevantDocuments", (original) => function patchedRetriever(this: unknown, ...args: unknown[]) {
        return client.span("retrieval", () => original.apply(this, args), {
          span_type: "retrieval",
          framework: "langchain",
        });
      });
      patchMethod(prototype, "invoke", (original) => function patchedInvoke(this: unknown, ...args: unknown[]) {
        const toolName =
          this && typeof this === "object" && "name" in (this as Record<string, unknown>) && typeof (this as Record<string, unknown>).name === "string"
            ? ((this as Record<string, unknown>).name as string)
            : undefined;
        return client.span("tool_call", () => original.apply(this, args), {
          span_type: "tool",
          framework: "langchain",
          ...(toolName ? { tool_name: toolName } : {}),
        });
      });
    }
  } catch {
    return;
  }
}

export async function instrumentLangChain(client: ReliaiClient): Promise<void> {
  await Promise.allSettled([
    patchLangChainModule(client, "langchain/chains"),
    patchLangChainModule(client, "@langchain/core/retrievers"),
    patchLangChainModule(client, "@langchain/core/tools"),
  ]);
}
