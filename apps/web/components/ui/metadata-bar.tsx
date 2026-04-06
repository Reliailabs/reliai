import type { ReactNode } from "react";

import { cn, truncateMiddle } from "@/lib/utils";
import { StatusDot } from "@/components/ui/status-dot";

type MetadataBarProps = {
  className?: string;
  children: ReactNode;
};

type MetadataItemProps = {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  truncate?: boolean;
  status?: "critical" | "success" | "neutral";
  className?: string;
};

export function MetadataBar({ className, children }: MetadataBarProps) {
  return (
    <div
      className={cn(
        "metadata-bar flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-secondary",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MetadataItem({
  label,
  value,
  mono,
  truncate,
  status,
  className
}: MetadataItemProps) {
  const displayValue =
    typeof value === "string" && truncate ? truncateMiddle(value) : value ?? "n/a";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-secondary">{label}</span>
      {status ? <StatusDot status={status} /> : null}
      <span className={cn("text-sm text-primary", mono && "text-mono-data")}>
        {displayValue}
      </span>
    </div>
  );
}
