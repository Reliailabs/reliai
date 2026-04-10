import { getProjects, getTraces } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { TracesView, type TraceRowData } from "./traces-view"

export default async function TracesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const environment = Array.isArray(params.environment) ? params.environment[0] : params.environment
  const successParam = Array.isArray(params.success) ? params.success[0] : params.success
  const projectId = Array.isArray(params.project_id) ? params.project_id[0] : params.project_id
  const cursor = Array.isArray(params.cursor) ? params.cursor[0] : params.cursor
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
  const success =
    successParam === "true" ? true : successParam === "false" ? false : undefined

  const [data, projects] = await Promise.all([
    getTraces({
      environment: environment || undefined,
      success,
      project_id: projectId || undefined,
      cursor: cursor || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    }),
    getProjects(),
  ])
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

  return (
    <TracesView
      traces={traces}
      nextCursor={data.next_cursor}
      projects={projects.items.map((project) => ({ id: project.id, name: project.name }))}
      filters={{
        environment: environment || "",
        success: successParam || "",
        projectId: projectId || "",
        cursor: cursor || "",
      }}
    />
  )
}
