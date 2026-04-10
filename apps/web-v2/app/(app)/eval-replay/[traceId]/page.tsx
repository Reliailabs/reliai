import { getTraceReplay } from "@/lib/api"
import { formatRelativeTime } from "@/lib/time"
import { EvalReplayView } from "./eval-replay-view"

export default async function EvalReplayPage({
  params,
}: {
  params: Promise<{ traceId: string }>
}) {
  const { traceId } = await params
  const replay = await getTraceReplay(traceId)
  const now = Date.now()
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
