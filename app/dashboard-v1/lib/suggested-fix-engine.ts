import type { RootCauseSummary } from "@/lib/root-cause-engine"
import { extractSignals } from "@/lib/root-cause-engine"

type FixType = "retrieval_quality" | "empty_results" | "instability" | "unknown"

type SpanLike = {
  span_type?: string | null
  success?: boolean
  metadata_json?: unknown
  latency_ms?: number | null
}

export type SuggestedFix = {
  title: string
  actions: string[]
  pr_changes: string[]
}

export type ConfigPatchItem = {
  key: string
  from: string | number | boolean | null
  to: string | number | boolean | null
}

const PATCH_KEYS = new Set([
  "retrieval_version",
  "temperature",
  "top_k",
  "similarity_threshold",
])

function parseValue(value: string): string | number | boolean | null {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null
  if (trimmed.toLowerCase() === "true") return true
  if (trimmed.toLowerCase() === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }
  return trimmed
}

export function buildConfigPatch(changes: string[]): ConfigPatchItem[] {
  return changes
    .map((change) => {
      const [left, right] = change.split(":")
      if (!right) return null
      const key = left.trim()
      if (!PATCH_KEYS.has(key)) return null
      const arrow = right.includes("→") ? "→" : "->"
      const parts = right.split(arrow).map((part) => part.trim())
      if (parts.length !== 2) return null
      return {
        key,
        from: parseValue(parts[0]),
        to: parseValue(parts[1]),
      }
    })
    .filter((item): item is ConfigPatchItem => item !== null)
}

export function classifyFix(spans: SpanLike[]): FixType {
  const signals = extractSignals(spans)
  if (signals.some((signal) => signal.failure_reason === "low_similarity")) {
    return "retrieval_quality"
  }
  if (signals.some((signal) => signal.documents_found === 0)) {
    return "empty_results"
  }
  if (signals.some((signal) => signal.retry_attempt > 1)) {
    return "instability"
  }
  return "unknown"
}

export function buildSuggestedFix(
  spans: SpanLike[],
  rootCause?: RootCauseSummary | null
): SuggestedFix | null {
  const fixType = classifyFix(spans)

  if (fixType === "retrieval_quality") {
    return {
      title: "Improve retrieval relevance",
      actions: [
        "Reduce embedding distance threshold",
        "Tune retrieval query",
        "Adjust vector search parameters",
      ],
      pr_changes: [
        "similarity_threshold: 0.85 → 0.75",
        "top_k: 5 → 8",
      ],
    }
  }

  if (fixType === "empty_results") {
    return {
      title: "Prevent empty retrieval responses",
      actions: ["Expand retrieval search window", "Increase retrieval recall"],
      pr_changes: [
        "top_k: 5 → 10",
        "similarity_threshold: 0.8 → 0.7",
      ],
    }
  }

  if (fixType === "instability") {
    return {
      title: "Stabilize retriever behavior",
      actions: ["Rollback retriever version", "Reduce temperature", "Stabilize retrieval settings"],
      pr_changes: [
        "retrieval_version: v2 → v1",
        "temperature: 0.4 → 0.1",
      ],
    }
  }

  if (rootCause) {
    return {
      title: rootCause.title,
      actions: ["Review retriever configuration", "Validate retrieval context coverage"],
      pr_changes: ["retrieval_version: v2 → v1", "similarity_threshold: 0.85 → 0.75"],
    }
  }

  return null
}
