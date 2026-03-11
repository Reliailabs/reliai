import type { ReliaiClient } from "../client.ts";

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<Record<string, unknown>>;

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

export async function instrumentLlamaIndex(client: ReliaiClient): Promise<void> {
  try {
    const imported = await dynamicImport("llamaindex");
    const candidates = Object.values(imported).filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "function");
    for (const candidate of candidates) {
      const prototype = candidate.prototype as Record<string, unknown> | undefined;
      if (!prototype) {
        continue;
      }
      patchMethod(prototype, "query", (original) => function patchedQuery(this: unknown, ...args: unknown[]) {
        return client.span("llm_call", () => original.apply(this, args), {
          span_type: "llm",
          framework: "llamaindex",
        });
      });
      patchMethod(prototype, "retrieve", (original) => function patchedRetrieve(this: unknown, ...args: unknown[]) {
        return client.span("retrieval", () => original.apply(this, args), {
          span_type: "retrieval",
          framework: "llamaindex",
        });
      });
    }
  } catch {
    return;
  }
}
