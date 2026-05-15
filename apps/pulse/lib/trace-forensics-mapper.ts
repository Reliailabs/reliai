type TraceDetailRead = {
  trace_id: string;
  request_id: string;
  success: boolean;
  latency_ms?: number | null;
  environment?: string | null;
  created_at?: string | null;
  model_name?: string | null;
  prompt_version?: string | null;
  error_type?: string | null;
  compare_path?: string | null;
  payload_truncated?: boolean | null;
};

type TraceAnalysisRead = {
  slowest_span?: { span_id: string; span_name?: string | null; latency_ms?: number | null } | null;
  largest_token_span?: { span_id: string; span_name?: string | null; token_count?: number | null } | null;
  most_guardrail_retries?: { span_id: string; guardrail_policy?: string | null; retry_count?: number | null } | null;
} | null;

type TraceCompareRead = {
  pairs?: Array<{
    diff_blocks?: Array<{ changed?: boolean | null }>;
    baseline_trace?: { id: string; request_id?: string | null } | null;
  }>;
} | null;

type TraceGraphRead = {
  trace_id: string;
  environment?: string | null;
  nodes?: unknown[];
  edges?: unknown[];
} | null;

export type TraceForensicsPresenter = {
  detail: {
    traceId: string;
    requestId: string;
    success: boolean;
    latencyMs: number | null;
    environment: string | null;
    createdAt: string | null;
    modelName: string | null;
    promptVersion: string | null;
    errorType: string | null;
    comparePath: string | null;
    payloadTruncated: boolean;
  };
  findings: Array<{ label: string; detail: string }>;
  compare: {
    changedBlockCount: number;
    totalBlockCount: number;
    baselineTraceId: string | null;
    baselineRequestId: string | null;
  } | null;
  graph: {
    nodeCount: number;
    edgeCount: number;
    environment: string | null;
  } | null;
};

export function mapTraceForensicsPresenter(input: {
  detail: TraceDetailRead;
  analysis: TraceAnalysisRead;
  compare: TraceCompareRead;
  graph: TraceGraphRead;
}): TraceForensicsPresenter {
  const detail = input.detail;
  const findings: Array<{ label: string; detail: string }> = [];
  if (input.analysis?.slowest_span) {
    const span = input.analysis.slowest_span;
    findings.push({
      label: "Slowest step",
      detail: `${span.span_name ?? "Span"} · ${span.latency_ms ?? 0} ms`,
    });
  }
  if (input.analysis?.largest_token_span) {
    const span = input.analysis.largest_token_span;
    findings.push({
      label: "Token spike",
      detail: `${span.span_name ?? "Span"} · ${span.token_count ?? 0} tokens`,
    });
  }
  if (input.analysis?.most_guardrail_retries) {
    const span = input.analysis.most_guardrail_retries;
    findings.push({
      label: "Guardrail retries",
      detail: `${span.guardrail_policy ?? "Guardrail"} · ${span.retry_count ?? 0} retries`,
    });
  }

  const pair = input.compare?.pairs?.[0] ?? null;
  const diffBlocks = pair?.diff_blocks ?? [];
  const changedBlockCount = diffBlocks.filter((block) => Boolean(block.changed)).length;
  const compare = pair
    ? {
        changedBlockCount,
        totalBlockCount: diffBlocks.length,
        baselineTraceId: pair.baseline_trace?.id ?? null,
        baselineRequestId: pair.baseline_trace?.request_id ?? null,
      }
    : null;

  const graph = input.graph
    ? {
        nodeCount: input.graph.nodes?.length ?? 0,
        edgeCount: input.graph.edges?.length ?? 0,
        environment: input.graph.environment ?? null,
      }
    : null;

  return {
    detail: {
      traceId: detail.trace_id,
      requestId: detail.request_id,
      success: detail.success,
      latencyMs: detail.latency_ms ?? null,
      environment: detail.environment ?? null,
      createdAt: detail.created_at ?? null,
      modelName: detail.model_name ?? null,
      promptVersion: detail.prompt_version ?? null,
      errorType: detail.error_type ?? null,
      comparePath: detail.compare_path ?? null,
      payloadTruncated: Boolean(detail.payload_truncated),
    },
    findings,
    compare,
    graph,
  };
}
