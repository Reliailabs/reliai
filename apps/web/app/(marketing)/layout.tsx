import type { ReactNode } from "react";
import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Reliai | AI Reliability Command Center",
  description:
    "Reliai monitors AI agents, RAG systems, and model behavior to detect regressions, surface incidents, and prove reliability in production.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <MarketingHeader />
      {children}
    </MarketingShell>
  );
}
