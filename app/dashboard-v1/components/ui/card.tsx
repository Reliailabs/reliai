import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border border-zinc-800 bg-zinc-900 text-zinc-100 rounded-lg shadow-sm",
        className
      )}
      {...props}
    />
  );
}