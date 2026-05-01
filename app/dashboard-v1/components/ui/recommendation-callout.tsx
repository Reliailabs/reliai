import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function RecommendationCallout({
  label = "Recommendation",
  recommendation,
  supporting,
  className,
}: {
  label?: string
  recommendation: ReactNode
  supporting?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 text-zinc-100",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-100">{recommendation}</p>
      {supporting ? <div className="mt-2 text-sm text-zinc-400">{supporting}</div> : null}
    </div>
  )
}
