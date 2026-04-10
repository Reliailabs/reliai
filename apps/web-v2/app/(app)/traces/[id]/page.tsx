import { getTraceDetail } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { TraceDetailView } from "./trace-detail-view"

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const trace = await getTraceDetail(id)
  const now = Date.now()

  const status = trace.refusal_detected
    ? "refusal"
    : trace.success
      ? "success"
      : "failed"

  const latencySeconds =
    trace.latency_ms === null ? null : Math.max(0, trace.latency_ms) / 1000

  return (
    <TraceDetailView
      trace={{
        id: trace.id,
        requestId: trace.request_id,
        traceId: trace.trace_id,
        spanId: trace.span_id,
        spanName: trace.span_name,
        status,
        environment: trace.environment === "staging" ? "staging" : "production",
        model: trace.model_name,
        modelProvider: trace.model_provider,
        promptVersion: trace.prompt_version,
        promptVersionRecord: trace.prompt_version_record
          ? {
              id: trace.prompt_version_record.id,
              version: trace.prompt_version_record.version,
              label: trace.prompt_version_record.label,
            }
          : null,
        modelVersionRecord: trace.model_version_record
          ? {
              provider: trace.model_version_record.provider,
              modelName: trace.model_version_record.model_name,
              modelVersion: trace.model_version_record.model_version,
              label: trace.model_version_record.label,
            }
          : null,
        projectId: trace.project_id,
        userId: trace.user_id,
        sessionId: trace.session_id,
        age: formatRelativeTime(trace.timestamp ?? trace.created_at, now),
        latency: latencySeconds === null ? null : latencySeconds,
        promptTokens: trace.prompt_tokens,
        completionTokens: trace.completion_tokens,
        totalCostUsd: trace.total_cost_usd,
        errorType: trace.error_type,
        guardrailPolicy: trace.guardrail_policy,
        guardrailAction: trace.guardrail_action,
        inputText: trace.input_text,
        outputText: trace.output_text,
        payloadTruncated: trace.payload_truncated ?? false,
        metadataJson: trace.metadata_json,
        retrievalSpan: trace.retrieval_span
          ? {
              retrievalLatencyMs: trace.retrieval_span.retrieval_latency_ms,
              sourceCount: trace.retrieval_span.source_count,
              topK: trace.retrieval_span.top_k,
              queryText: trace.retrieval_span.query_text,
            }
          : null,
        evaluations: trace.evaluations.map((ev) => ({
          id: ev.id,
          evalType: ev.eval_type,
          score: ev.score,
          label: ev.label,
          explanation: ev.explanation,
          evaluatorModel: ev.evaluator_model,
        })),
        customMetrics: (trace.custom_metric_results ?? []).map((m) => ({
          name: m.name,
          matched: m.matched,
          value: m.value,
        })),
      }}
    />
  )
}
