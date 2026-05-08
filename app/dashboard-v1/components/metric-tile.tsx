import { cn } from "@/lib/utils"

interface MetricTileProps {
  label: string
  value: string
  tone: "critical" | "warning" | "stable" | "neutral"
}

const toneStyles = {
  critical: "border-red-500/50 bg-red-500/5",
  warning: "border-amber-500/50 bg-amber-500/5", 
  stable: "border-emerald-500/50 bg-emerald-500/5",
  neutral: "border-zinc-500/50 bg-zinc-500/5"
}

export function MetricTile({ label, value, tone }: MetricTileProps) {
  return (
    <div className={cn("border rounded-lg p-4", toneStyles[tone])}>
      <div className="text-sm font-medium text-zinc-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
    </div>
  )
}
