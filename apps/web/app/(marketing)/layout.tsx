import type { ReactNode } from "react";
import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Reliai | AI Incident Response",
  description:
    "Reliai detects behavioral regressions in production AI — refusals, output failures, metric spikes — opens incidents automatically, and surfaces root cause. Not a dashboard. An incident response system.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <MarketingHeader />
      {children}
    </MarketingShell>
  );
}
