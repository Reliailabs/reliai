import type { HTMLAttributes, ElementType } from "react";

import { cn } from "@/lib/utils";

interface SectionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function SectionHeading({
  as: Component = "h2",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <Component
      className={cn(
        "text-lg font-semibold text-zinc-100",
        className
      )}
      {...props}
    />
  );
}

export function SectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold text-zinc-500 uppercase tracking-widest",
        className
      )}
      {...props}
    />
  );
}