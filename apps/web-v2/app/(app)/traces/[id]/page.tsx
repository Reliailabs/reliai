import { getTraceDetail, getTraceGraph, getTraceGraphAnalysis } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { TraceDetailTabs } from "./trace-detail-tabs"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [trace, graph, analysis] = await Promise.all([
    getTraceDetail(id),
    getTraceGraph(id).catch(() => null),
    getTraceGraphAnalysis(id).catch(() => null),
  ])

  const now = Date.now()

  const status = trace.refusal_detected
    ? "refusal"
    : trace.success
      ? "success"
      : "failed"

  const latencySeconds =
    trace.latency_ms === null ? null : Math.max(0, trace.latency_ms) / 1000

  const statusDot: Record<typeof status, string> = {
    success: "bg-emerald-500",
    failed:  "bg-red-500",
    refusal: "bg-amber-500",
  }

  const statusText: Record<typeof status, string> = {
    success: "text-emerald-400",
    failed:  "text-red-400",
    refusal: "text-amber-400",
  }

  const statusLabel: Record<typeof status, string> = {
    success: "Success",
    failed:  "Failed",
    refusal: "Refusal",
  }

  return (
    <>
      <PageHeader
        title={trace.request_id}
        description={`${trace.model_name} · ${trace.environment === "staging" ? "staging" : "production"} · ${formatRelativeTime(trace.timestamp ?? trace.created_at, now)}`}
        right={
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full shrink-0", statusDot[status])} />
            <span className={cn("text-xs font-medium", statusText[status])}>
              {statusLabel[status]}
            </span>
            {trace.environment === "staging" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5">
                staging
              </span>
            )}
          </div>
        }
      />

      <TraceDetailTabs
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
          latency: latencySeconds,
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
                retrievedChunks: trace.retrieval_span.retrieved_chunks_json ?? null,
              }
            : null,
          evaluations: trace.evaluations.map((ev) => ({
            id: ev.id,
            evalType: ev.eval_type,
            score: ev.score,
            label: ev.label,
            explanation: ev.explanation,
            evaluatorModel: ev.evaluator_model,
            evaluatorProvider: ev.evaluator_provider ?? null,
            evaluatorVersion: ev.evaluator_version ?? null,
            rawResultJson: ev.raw_result_json ?? null,
          })),
          customMetrics: (trace.custom_metric_results ?? []).map((m) => ({
            name: m.name,
            matched: m.matched,
            value: m.value,
          })),
        }}
        graph={graph}
        analysis={analysis}
      />
    </>
  )
}
