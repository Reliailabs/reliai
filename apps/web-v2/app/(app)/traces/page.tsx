import { getTraces } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { TracesView, type TraceRowData } from "./traces-view"

export default async function TracesPage() {
  const data = await getTraces()
  const now = Date.now()

  const traces: TraceRowData[] = data.items.map((trace) => {
    const status = trace.refusal_detected
      ? "refusal"
      : trace.success
        ? "success"
        : "failed"
    const latencySeconds =
      trace.latency_ms === null ? null : Math.max(0, trace.latency_ms) / 1000

    return {
      id: trace.id,
      requestId: trace.request_id,
      status,
      model: trace.model_name,
      promptVersion: trace.prompt_version ?? "—",
      latency: latencySeconds === null ? "—" : `${latencySeconds.toFixed(2)}s`,
      tokens: "—",
      environment: trace.environment === "staging" ? "staging" : "production",
      age: formatRelativeTime(trace.timestamp ?? trace.created_at, now),
    }
  })

  return <TracesView traces={traces} />
}
