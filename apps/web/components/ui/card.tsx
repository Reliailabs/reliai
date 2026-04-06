import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-surface border border-line bg-surface text-primary shadow-sm !p-[var(--spacing-card)]",
        className
      )}
      {...props}
    />
  );
}
