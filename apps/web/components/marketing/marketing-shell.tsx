"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo");

  return (
    <div
      className={cn(
        "min-h-screen",
        isDemo ? "app-shell bg-bg text-textPrimary" : "bg-page text-primary"
      )}
    >
      {children}
    </div>
  );
}
