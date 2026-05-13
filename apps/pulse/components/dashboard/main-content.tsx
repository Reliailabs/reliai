"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Section } from "@/components/dashboard/sections";
import { OverviewContent } from "./content/overview-content";
import { IncidentsContent } from "./content/incidents-content";
import { DeploymentsContent } from "./content/deployments-content";
import { PerformanceContent } from "./content/performance-content";
import { ErrorsContent } from "./content/errors-content";
import { SlaContent } from "./content/sla-content";
import { OncallContent } from "./content/oncall-content";
import { AuditsContent } from "./content/audits-content";
import { ServicesContent } from "./content/services-content";
import { PostmortemsContent } from "./content/postmortems-content";
import { RiskReviewsContent } from "./content/risk-reviews-content";
import { SettingsContent } from "./content/settings-content";
import { Bell, Calendar, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { IncidentRouteContext } from "@/components/dashboard/pulse-types";
import type { AuditRouteContext } from "@/components/dashboard/pulse-types";
import type { TraceRouteContext } from "@/components/dashboard/pulse-types";
import type { DeploymentRouteContext } from "@/components/dashboard/pulse-types";
import type { ProjectRouteContext } from "@/components/dashboard/pulse-types";
import type { ProjectControlParityData } from "@/components/dashboard/pulse-types";
import type { OperationsSurfaceData } from "@/components/dashboard/pulse-types";
import { OperationsTimelineView } from "@/components/operations/operations-timeline-view";

interface MainContentProps {
  activeSection: Section;
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
  incidentContext?: IncidentRouteContext;
  auditContext?: AuditRouteContext;
  traceContext?: TraceRouteContext;
  deploymentContext?: DeploymentRouteContext;
  projectContext?: ProjectRouteContext;
  projectControlData?: ProjectControlParityData;
  operationsData?: OperationsSurfaceData;
}

const alertInboxItems = [
  {
    id: "alert-inc-001",
    title: "SEV-1 incident requires response",
    meta: "2m ago • Incident",
    href: "/incidents",
  },
  {
    id: "alert-trace-001",
    title: "Trace regression detected in production",
    meta: "7m ago • Traces",
    href: "/traces",
  },
  {
    id: "alert-oncall-001",
    title: "On-call escalation triggered",
    meta: "12m ago • On-Call",
    href: "/on-call",
  },
] as const;

type PrimaryAction = { label: string; href: string; icon: React.ReactNode };

const sectionConfig: Record<Section, { title: string; subtitle: string; primaryAction?: PrimaryAction }> = {
  overview: {
    title: "Pulse Overview",
    subtitle: "Real-time AI reliability signals",
    primaryAction: { label: "Report Incident", href: "/incidents", icon: <AlertCircle className="w-4 h-4" /> },
  },
  incidents: {
    title: "Incidents",
    subtitle: "Active & Recent Incidents",
    primaryAction: { label: "Report Incident", href: "/incidents", icon: <AlertCircle className="w-4 h-4" /> },
  },
  deployments: {
    title: "Deployments",
    subtitle: "Model and workflow release history",
  },
  traces: {
    title: "Traces",
    subtitle: "Trace-level behavior and drift signals",
  },
  metrics: {
    title: "Metrics",
    subtitle: "Reliability metrics and failed evaluations",
  },
  guardrails: {
    title: "Guardrails",
    subtitle: "Unsafe output and policy violation monitoring",
  },
  audits: {
    title: "Audits",
    subtitle: "Audit status and certification posture",
  },
  systems: {
    title: "Systems",
    subtitle: "Production AI systems and model versions",
  },
  risk_reviews: {
    title: "Risk Reviews",
    subtitle: "Reliability risk reviews and evidence synthesis",
  },
  performance: {
    title: "Traces",
    subtitle: "Trace-level behavior and drift signals",
  },
  errors: {
    title: "Metrics",
    subtitle: "Reliability metrics and failed evaluations",
  },
  sla: {
    title: "Guardrails",
    subtitle: "Unsafe output and policy violation monitoring",
  },
  oncall: {
    title: "On-Call",
    subtitle: "Escalation and response coverage",
  },
  services: {
    title: "Systems",
    subtitle: "Production AI systems and model versions",
  },
  postmortems: {
    title: "Risk Reviews",
    subtitle: "Findings, remediation, and evidence reviews",
  },
  settings: {
    title: "Settings",
    subtitle: "Configuration & Integrations",
  },
  operations: {
    title: "Operations Center",
    subtitle: "Proposal lifecycle, policy gates, and execution audit trail",
  },
};

export function MainContent({
  activeSection,
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
  incidentContext,
  auditContext,
  traceContext,
  deploymentContext,
  projectContext,
  projectControlData,
  operationsData,
}: MainContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();
  const config = sectionConfig[activeSection];

  const setTimeRange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <OverviewContent
            pulseOverviewData={pulseOverviewData}
            causalityEvidenceData={causalityEvidenceData}
            attributionSuggestionsData={attributionSuggestionsData}
            projectControlData={projectControlData}
          />
        );
      case "incidents":
        return <IncidentsContent incidentsData={incidentsData} incidentContext={incidentContext} />;
      case "deployments":
        return <DeploymentsContent deploymentsData={deploymentsData} deploymentContext={deploymentContext} />;
      case "traces":
      case "performance":
        return <PerformanceContent tracesData={tracesData} traceContext={traceContext} />;
      case "metrics":
      case "errors":
        return <ErrorsContent errorsData={errorsData} />;
      case "guardrails":
      case "sla":
        return <SlaContent guardrailsData={guardrailsData} />;
      case "audits":
        return <AuditsContent auditsData={auditsData} auditContext={auditContext} />;
      case "oncall":
        return <OncallContent oncallData={oncallData} />;
      case "systems":
      case "services":
        return <ServicesContent servicesData={servicesData} />;
      case "risk_reviews":
        return <RiskReviewsContent />;
      case "postmortems":
        return <PostmortemsContent postmortemsData={postmortemsData} />;
      case "settings":
        return <SettingsContent settingsData={settingsData} />;
      case "operations":
        return <OperationsTimelineView operationsData={operationsData} />;
      default:
        return (
          <OverviewContent
            causalityEvidenceData={causalityEvidenceData}
            attributionSuggestionsData={attributionSuggestionsData}
            projectControlData={projectControlData}
          />
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
          {projectContext ? (
            <p className="text-xs text-muted-foreground">
              Project route context: {projectContext.projectId} · {projectContext.mode}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={() => setTimeRange("24h")}
          >
            <Calendar className="w-4 h-4" />
            <span>Last 24 hours</span>
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          {/* Alerts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-xl hover:bg-muted transition-colors"
                aria-label="Alerts inbox"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0">
              <div className="p-3">
                <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold text-foreground">
                  Alert Inbox
                </DropdownMenuLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  Read-only alerts. Requires operator review.
                </p>
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-[320px] overflow-y-auto p-2">
                {alertInboxItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
                  </Link>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button asChild variant="outline" size="sm" className="w-full bg-transparent">
                  <Link href="/on-call">Open On-Call Queue</Link>
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Primary Action — section-aware */}
          {config.primaryAction ? (
            <Button asChild size="sm" className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <Link href={config.primaryAction.href}>
                {config.primaryAction.icon}
                <span>{config.primaryAction.label}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div key={activeSection} className="animate-fade-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
