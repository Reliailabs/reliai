import { cn } from "@/lib/utils"
import type { Severity } from "@/lib/mock-data"

const configs: Record<Severity | "resolved", string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high:     "bg-amber-500/10 text-amber-400 border-amber-500/30",
  medium:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low:      "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
}

interface Props {
  severity: Severity | "resolved"
  className?: string
}

export function SeverityBadge({ severity, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
        configs[severity],
        className
      )}
    >
      {severity}
    </span>
  )
}
