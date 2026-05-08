import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function RecommendationCallout({
  label = "Recommendation",
  recommendation,
  supporting,
  className,
}: {
  label?: string;
  recommendation: ReactNode;
  supporting?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surfaceAlt px-4 py-4 text-textPrimary",
        className
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-textSecondary">{label}</p>
      <p className="mt-2 text-sm font-semibold text-textPrimary">{recommendation}</p>
      {supporting ? <div className="mt-2 text-sm text-textSecondary">{supporting}</div> : null}
    </div>
  );
}
