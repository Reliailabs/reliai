export function percent(value: number | null) {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

export function decimal(value: number | null) {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

export function latency(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value)}ms`;
}

export function formatTime(value: string | null, screenshotMode = false) {
  if (!value) return "n/a";
  if (screenshotMode) {
    return "Today";
  }
  return new Date(value).toLocaleString();
}

export function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-rose-700";
}

export function riskTone(level: string | null) {
  if (level === "high") return "text-rose-700";
  if (level === "medium") return "text-amber-700";
  if (level === "low") return "text-emerald-700";
  return "text-steel";
}

export function coverageTone(value: number) {
  if (value >= 95) return "text-emerald-700";
  if (value >= 85) return "text-amber-700";
  return "text-rose-700";
}

export function actionStatusTone(status: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "dry_run") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status.startsWith("skipped_")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

export function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (severity === "medium") return "bg-orange-100 text-orange-800 ring-1 ring-orange-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export function renderProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function gateTone(decision: string | null | undefined) {
  if (decision === "BLOCK") return "border-rose-300 bg-rose-50 text-rose-800";
  if (decision === "WARN") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-emerald-300 bg-emerald-50 text-emerald-800";
}

export function gateLabel(decision: string | null | undefined) {
  if (decision === "BLOCK") return "BLOCKED";
  if (decision === "WARN") return "WARNING";
  return "SAFE";
}

export function renderMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No metadata recorded.";
  }
  return JSON.stringify(metadata, null, 2);
}
