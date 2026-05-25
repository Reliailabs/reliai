"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { RightPanel } from "@/components/dashboard/right-panel";
import type { Section } from "@/components/dashboard/sections";

const routeBySection: Partial<Record<Section, string>> = {
  overview: "/pulse",
  incidents: "/incidents",
  deployments: "/deployments",
  traces: "/traces",
  metrics: "/metrics",
  guardrails: "/guardrails",
  audits: "/audits",
  services: "/services",
  errors: "/errors",
  performance: "/traces",
  sla: "/metrics",
  oncall: "/on-call",
  postmortems: "/postmortems",
  settings: "/settings",
  operations: "/operations",
};

export function AppShellFrame({
  activeSection = "overview",
  children,
}: {
  activeSection?: Section;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<Section>(activeSection);
  const scopedProjectId = searchParams.get("project_id");

  useEffect(() => {
    setSection(activeSection);
  }, [activeSection]);

  function withScopedProject(path: string): string {
    if (!scopedProjectId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}project_id=${encodeURIComponent(scopedProjectId)}`;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        activeSection={section}
        onSectionChange={(nextSection) => {
          setSection(nextSection);
          const route = routeBySection[nextSection];
          if (route) router.push(withScopedProject(route));
        }}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <RightPanel />
    </div>
  );
}
