export { ReliaiClient, getDefaultClient, span, type ReliaiClientOptions, type ReliaiSpanScope } from "./client.ts";
export { llmCall, postprocess, promptBuild, retrieval, toolCall, type ReliaiPipelineMetadata } from "./pipeline.ts";
export { replay, ReliaiReplayPipeline, type ReliaiReplayPayload, type ReliaiReplayStep } from "./replay.ts";
export {
  costBudget,
  latencyRetry,
  structuredOutput,
} from "./guardrails.ts";
export type { GuardrailAction, ReliaiGuardrailEvent } from "./guardrails.ts";
export type { ReliaiRetrievalSpan, ReliaiTraceEvent } from "./tracing.ts";
export { enableAutoInstrumentation, disableAutoInstrumentation } from "./auto.ts";
