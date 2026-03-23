import type { ReactNode } from "react";
import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Reliai | Reliability Control Plane for Production AI",
  description:
    "Reliai detects AI regressions, explains root causes, and applies guardrails before failures impact users.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <MarketingHeader />
      {children}
    </MarketingShell>
  );
}
