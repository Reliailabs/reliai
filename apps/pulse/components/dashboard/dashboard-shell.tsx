"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";
import type { Section } from "@/components/dashboard/sections";
import type { PulseOverviewData } from "@/components/dashboard/pulse-types";
import type { CausalityEvidenceData } from "@/components/dashboard/pulse-types";
import type { AttributionSuggestionData } from "@/components/dashboard/pulse-types";
import type { ServicesSurfaceData } from "@/components/dashboard/pulse-types";
import type { IncidentsSurfaceData } from "@/components/dashboard/pulse-types";
import type { ErrorsSurfaceData } from "@/components/dashboard/pulse-types";
import type { TracesSurfaceData } from "@/components/dashboard/pulse-types";
import type { DeploymentsSurfaceData } from "@/components/dashboard/pulse-types";
import type { AuditsSurfaceData } from "@/components/dashboard/pulse-types";
import type { GuardrailsSurfaceData } from "@/components/dashboard/pulse-types";
import type { OncallSurfaceData } from "@/components/dashboard/pulse-types";
import type { PostmortemsSurfaceData } from "@/components/dashboard/pulse-types";
import type { SettingsSurfaceData } from "@/components/dashboard/pulse-types";

interface DashboardShellProps {
  initialSection: Section;
  pulseOverviewData?: PulseOverviewData;
  causalityEvidenceData?: CausalityEvidenceData;
  attributionSuggestionsData?: AttributionSuggestionData;
  servicesData?: ServicesSurfaceData;
  incidentsData?: IncidentsSurfaceData;
  errorsData?: ErrorsSurfaceData;
  tracesData?: TracesSurfaceData;
  deploymentsData?: DeploymentsSurfaceData;
  auditsData?: AuditsSurfaceData;
  guardrailsData?: GuardrailsSurfaceData;
  oncallData?: OncallSurfaceData;
  postmortemsData?: PostmortemsSurfaceData;
  settingsData?: SettingsSurfaceData;
}

export function DashboardShell({
  initialSection,
  pulseOverviewData,
  causalityEvidenceData,
  attributionSuggestionsData,
  servicesData,
  incidentsData,
  errorsData,
  tracesData,
  deploymentsData,
  auditsData,
  guardrailsData,
  oncallData,
  postmortemsData,
  settingsData,
}: DashboardShellProps) {
  const [activeSection, setActiveSection] = useState<Section>(initialSection);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <MainContent
        activeSection={activeSection}
        pulseOverviewData={pulseOverviewData}
        causalityEvidenceData={causalityEvidenceData}
        attributionSuggestionsData={attributionSuggestionsData}
        servicesData={servicesData}
        incidentsData={incidentsData}
        errorsData={errorsData}
        tracesData={tracesData}
        deploymentsData={deploymentsData}
        auditsData={auditsData}
        guardrailsData={guardrailsData}
        oncallData={oncallData}
        postmortemsData={postmortemsData}
        settingsData={settingsData}
      />
      <RightPanel pulseOverviewData={pulseOverviewData} />
    </div>
  );
}
