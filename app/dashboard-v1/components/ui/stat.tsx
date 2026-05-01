import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface StatProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "lg" | "xl";
}

export function Stat({
  variant = "lg",
  className,
  ...props
}: StatProps) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums text-zinc-100",
        variant === "lg" && "text-lg",
        variant === "xl" && "text-2xl",
        className
      )}
      {...props}
    />
  );
}