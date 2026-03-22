type TraceSignal = {
  span_type: string | null;
  success: boolean;
  failure_reason?: string | null;
  retry_attempt: number;
  documents_found: number;
  retrieval_version?: string | null;
  explanation?: string | null;
  duration: number | null;
};

export type RootCauseSummary = {
  title: string;
  summary: string;
  evidence: string[];
};

type SpanLike = {
  span_type?: string | null;
  success?: boolean;
  metadata_json?: unknown;
  latency_ms?: number | null;
};

export function extractSignals(spans: SpanLike[]): TraceSignal[] {
  return spans.map((span) => {
    const attrs =
      (span.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
        ?.attributes ?? {};

    return {
      span_type: (span.span_type as string | null) ?? null,
      success: Boolean(span.success),
      failure_reason: typeof attrs.failure_reason === "string" ? attrs.failure_reason : null,
      retry_attempt:
        typeof attrs.retry_attempt === "number"
          ? attrs.retry_attempt
          : typeof attrs.retry_attempt === "string"
            ? Number(attrs.retry_attempt)
            : 0,
      documents_found:
        typeof attrs.documents_found === "number"
          ? attrs.documents_found
          : typeof attrs.documents_found === "string"
            ? Number(attrs.documents_found)
            : 0,
      retrieval_version: typeof attrs.retrieval_version === "string" ? attrs.retrieval_version : null,
      explanation: typeof attrs.explanation === "string" ? attrs.explanation : null,
      duration: typeof span.latency_ms === "number" ? span.latency_ms : null,
    };
  });
}

export function buildRootCause(signals: TraceSignal[]): RootCauseSummary | null {
  const failures = signals.filter((signal) => signal.failure_reason);
  const recovery = signals.find((signal) => signal.retry_attempt > 1 && signal.success);

  if (failures.length && recovery) {
    const evidence = failures.map((signal) => `failure_reason: ${signal.failure_reason}`);
    if (failures.some((signal) => signal.documents_found === 0)) {
      evidence.push("documents_found: 0");
    }
    evidence.push(`retry_attempt: ${recovery.retry_attempt}`);
    if (recovery.explanation) {
      evidence.push(recovery.explanation);
    }

    return {
      title: "Retriever failed then recovered after retry",
      summary:
        "Initial retrieval returned no relevant documents, but retry succeeded with improved context.",
      evidence,
    };
  }

  if (failures.length) {
    return {
      title: "Retriever failing without recovery",
      summary: "Retriever consistently failed to return relevant documents.",
      evidence: failures.map((signal) => `failure_reason: ${signal.failure_reason}`),
    };
  }

  return null;
}
