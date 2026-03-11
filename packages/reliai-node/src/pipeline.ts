import { getDefaultClient, type ReliaiSpanScope } from "./client.ts";

export interface ReliaiPipelineMetadata {
  spanType?: string;
  model?: string;
  tokens?: number;
  vector_db?: string;
  tool_name?: string;
  prompt_template?: string;
  [key: string]: unknown;
}

async function runPipelineSpan<T>(
  name: string,
  spanType: string,
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return getDefaultClient().span(
    name,
    fn,
    {
      ...metadata,
      span_type: metadata.spanType ?? spanType,
    },
  );
}

export async function retrieval<T>(
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return runPipelineSpan("retrieval", "retrieval", fn, metadata);
}

export async function promptBuild<T>(
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return runPipelineSpan("prompt_build", "prompt", fn, metadata);
}

export async function llmCall<T>(
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return runPipelineSpan("llm_call", "llm", fn, metadata);
}

export async function toolCall<T>(
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return runPipelineSpan("tool_call", "tool", fn, metadata);
}

export async function postprocess<T>(
  fn: (scope: ReliaiSpanScope) => Promise<T> | T,
  metadata: ReliaiPipelineMetadata = {},
): Promise<T> {
  return runPipelineSpan("postprocess", "postprocess", fn, metadata);
}
