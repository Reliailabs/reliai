import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionProps = {
  children: ReactNode;
  size?: "normal" | "large";
  className?: string;
};

export function Section({ children, size = "normal", className }: SectionProps) {
  const spacing = size === "large" ? "mt-32" : "mt-24";

  return <section className={cn(spacing, className)}>{children}</section>;
}
