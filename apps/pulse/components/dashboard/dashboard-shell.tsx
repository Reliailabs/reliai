"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";
import type { Section } from "@/components/dashboard/sections";
import type { PulseOverviewData } from "@/components/dashboard/pulse-types";
import type { ServicesSurfaceData } from "@/components/dashboard/pulse-types";
import type { IncidentsSurfaceData } from "@/components/dashboard/pulse-types";
import type { ErrorsSurfaceData } from "@/components/dashboard/pulse-types";

interface DashboardShellProps {
  initialSection: Section;
  pulseOverviewData?: PulseOverviewData;
  servicesData?: ServicesSurfaceData;
  incidentsData?: IncidentsSurfaceData;
  errorsData?: ErrorsSurfaceData;
}

export function DashboardShell({
  initialSection,
  pulseOverviewData,
  servicesData,
  incidentsData,
  errorsData,
}: DashboardShellProps) {
  const [activeSection, setActiveSection] = useState<Section>(initialSection);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <MainContent
        activeSection={activeSection}
        pulseOverviewData={pulseOverviewData}
        servicesData={servicesData}
        incidentsData={incidentsData}
        errorsData={errorsData}
      />
      <RightPanel pulseOverviewData={pulseOverviewData} />
    </div>
  );
}
