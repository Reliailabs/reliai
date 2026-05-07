"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";
import type { Section } from "@/components/dashboard/sections";
import type { PulseOverviewData } from "@/components/dashboard/pulse-types";
import type { ServicesSurfaceData } from "@/components/dashboard/pulse-types";

interface DashboardShellProps {
  initialSection: Section;
  pulseOverviewData?: PulseOverviewData;
  servicesData?: ServicesSurfaceData;
}

export function DashboardShell({ initialSection, pulseOverviewData, servicesData }: DashboardShellProps) {
  const [activeSection, setActiveSection] = useState<Section>(initialSection);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <MainContent
        activeSection={activeSection}
        pulseOverviewData={pulseOverviewData}
        servicesData={servicesData}
      />
      <RightPanel pulseOverviewData={pulseOverviewData} />
    </div>
  );
}
