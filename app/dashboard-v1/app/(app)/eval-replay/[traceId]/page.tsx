import { getTraceReplay, getTraceDetail, getPromptVersions } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { EvalReplayView } from "./eval-replay-view"

interface ReplayResult {
  versionId: string
  output: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  score: number
  scoreLabel: string
  pass: boolean
}

export default async function EvalReplayPage({
  params,
}: {
  params: Promise<{ traceId: string }>
}) {
  const { traceId } = await params
  const now = Date.now()

  // Fetch trace detail for project ID and trace info
  const trace = await getTraceDetail(traceId).catch(() => null)
  if (!trace) {
    // Fallback to replay data if trace detail fails
    const replay = await getTraceReplay(traceId)
    const firstStep = replay.steps[0]
    const latencyMs =
      typeof firstStep?.parameters?.latency_ms === "number"
        ? firstStep.parameters.latency_ms
        : 0

    const traces = [
      {
        id: replay.trace_id,
        requestId: replay.trace_id.slice(0, 8),
        input: JSON.stringify(firstStep?.inputs ?? {}, null, 2),
        expectedOutput: firstStep?.prompt ?? "—",
        model: firstStep?.model ?? "—",
        project: replay.project_id,
        age: formatRelativeTime(new Date().toISOString(), now),
        regressionId: "—",
      },
    ]

    const promptVersions = [
      {
        id: "current",
        label: "Current",
        version: "v—",
        model: firstStep?.model ?? "—",
        promptText: firstStep?.prompt ?? "—",
      },
    ]

    const results = {
      [replay.trace_id]: {
        current: {
          versionId: "current",
          output: JSON.stringify(firstStep?.variables ?? {}, null, 2),
          latencyMs,
          inputTokens: 0,
          outputTokens: 0,
          score: 0.5,
          scoreLabel: "PASS",
          pass: true,
        },
      },
    }

    return <EvalReplayView traces={traces} promptVersions={promptVersions} results={results} />
  }

  // Real implementation with trace detail and prompt versions
  const replay = await getTraceReplay(traceId).catch(() => null)
  const firstStep = replay?.steps[0]
  
  // Fetch prompt versions for the project
  const promptVersionsResponse = await getPromptVersions(trace.project_id).catch(() => ({ items: [] }))
  
  const traces = [
    {
      id: trace.trace_id,
      requestId: trace.request_id,
      input: trace.input_text ? JSON.stringify(trace.input_text, null, 2) : "—",
      expectedOutput: trace.output_text ?? "—",
      model: trace.model_name,
      project: trace.project_id,
      age: formatRelativeTime(trace.timestamp ?? trace.created_at, now),
      regressionId: "—", // Could be extracted from metadata if available
    },
  ]

  const promptVersions = promptVersionsResponse.items.map((pv) => ({
    id: pv.id,
    label: pv.label ?? pv.version,
    version: pv.version,
    model: trace.model_name, // Could be from model_version_record if available
    promptText: (pv as any).prompt_text ?? "—", // eslint-disable-line @typescript-eslint/no-explicit-any
  }))

  // If we have replay data, include it as a result for the "current" version
  const results: Record<string, Record<string, ReplayResult>> = {}
  if (replay && firstStep) {
    const latencyMs =
      typeof firstStep?.parameters?.latency_ms === "number"
        ? firstStep.parameters.latency_ms
        : 0
    
    results[trace.trace_id] = {
      current: {
        versionId: "current",
        output: JSON.stringify(firstStep?.variables ?? {}, null, 2),
        latencyMs,
        inputTokens: trace.prompt_tokens ?? 0,
        outputTokens: trace.completion_tokens ?? 0,
        score: 0.5, // Placeholder - would come from evaluation
        scoreLabel: "PASS",
        pass: trace.success ?? false,
      },
    }
  }

  return <EvalReplayView traces={traces} promptVersions={promptVersions} results={results} />
}
