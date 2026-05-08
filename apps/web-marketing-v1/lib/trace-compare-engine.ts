type SpanNode = {
  latency_ms: number | null;
  success: boolean;
  metadata_json: Record<string, unknown> | null;
};

type Metrics = {
  avgLatency: number;
  retries: number;
  failures: number;
  documentsFound: number;
};

const NOISE_THRESHOLD = 0.05;

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAttributes(span: SpanNode) {
  return (span.metadata_json as { otel?: { attributes?: Record<string, unknown> } } | null)?.otel
    ?.attributes ?? {};
}

export function extractMetrics(spans: SpanNode[]): Metrics {
  const latencies = spans.map((span) => span.latency_ms ?? 0);
  const retries = spans.filter((span) => {
    const attrs = getAttributes(span);
    const retryAttempt = attrs.retry_attempt;
    const value =
      typeof retryAttempt === "number"
        ? retryAttempt
        : typeof retryAttempt === "string"
          ? Number(retryAttempt)
          : 0;
    return value > 0;
  }).length;
  const failures = spans.filter((span) => span.success === false).length;
  const documentsFound = avg(
    spans.map((span) => {
      const attrs = getAttributes(span);
      const value = attrs.documents_found;
      if (typeof value === "number") return value;
      if (typeof value === "string") return Number(value);
      return 0;
    })
  );

  return {
    avgLatency: avg(latencies),
    retries,
    failures,
    documentsFound,
  };
}

export function buildComparison(current: Metrics, baseline: Metrics): string[] {
  const deltas = [
    { key: "failures", label: "Failures", delta: current.failures - baseline.failures },
    { key: "retries", label: "Retries", delta: current.retries - baseline.retries },
    {
      key: "latency",
      label: "Latency",
      delta: Math.round(current.avgLatency - baseline.avgLatency),
      baseline: baseline.avgLatency,
    },
    {
      key: "documents",
      label: "Documents found",
      delta: Math.round(current.documentsFound - baseline.documentsFound),
      baseline: baseline.documentsFound,
    },
  ];

  const filtered = deltas.filter((item) => {
    if (item.key === "latency" || item.key === "documents") {
      const baselineValue = item.baseline ?? 0;
      if (baselineValue === 0) return item.delta !== 0;
      return Math.abs(item.delta) / baselineValue >= NOISE_THRESHOLD;
    }
    return item.delta !== 0;
  });

  return filtered.map((item) => {
    const sign = item.delta > 0 ? "+" : "";
    const suffix = item.key === "latency" ? "ms" : "";
    return `${item.label}: ${sign}${item.delta}${suffix}`;
  });
}
