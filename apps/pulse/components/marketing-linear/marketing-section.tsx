import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MarketingSectionProps {
  children: ReactNode
  py?: "hero" | "section"
  maxWidth?: "4xl" | "5xl" | "6xl"
  gradient?: boolean
  className?: string
  innerClassName?: string
}

export function MarketingSection({
  children,
  py = "section",
  maxWidth = "5xl",
  gradient = false,
  className,
  innerClassName,
}: MarketingSectionProps) {
  const pyClass = py === "hero" ? "pt-40 pb-24" : "py-24"
  const maxClass =
    maxWidth === "4xl" ? "max-w-4xl" : maxWidth === "6xl" ? "max-w-6xl" : "max-w-5xl"

  return (
    <div
      className={cn("relative z-20", pyClass, className)}
      style={{ backgroundColor: "#09090B" }}
    >
      {gradient && (
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: "20%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)",
          }}
        />
      )}
      <div className="w-full flex justify-center px-6">
        <div className={cn("w-full", maxClass, innerClassName)}>{children}</div>
      </div>
    </div>
  )
}
