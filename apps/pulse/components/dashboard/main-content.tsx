"use client";

import type { Section } from "@/components/dashboard/sections";
import { OverviewContent } from "./content/overview-content";
import { IncidentsContent } from "./content/incidents-content";
import { DeploymentsContent } from "./content/deployments-content";
import { PerformanceContent } from "./content/performance-content";
import { ErrorsContent } from "./content/errors-content";
import { SlaContent } from "./content/sla-content";
import { OncallContent } from "./content/oncall-content";
import { ServicesContent } from "./content/services-content";
import { PostmortemsContent } from "./content/postmortems-content";
import { RiskReviewsContent } from "./content/risk-reviews-content";
import { SettingsContent } from "./content/settings-content";
import { Bell, Calendar, RefreshCw, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PulseOverviewData } from "@/components/dashboard/pulse-types";

interface MainContentProps {
  activeSection: Section;
  pulseOverviewData?: PulseOverviewData;
}

const sectionConfig: Record<Section, { title: string; subtitle: string }> = {
  overview: {
    title: "Pulse Overview",
    subtitle: "Real-time AI reliability signals",
  },
  incidents: {
    title: "Incidents",
    subtitle: "Active & Recent Incidents",
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
    title: "Audits",
    subtitle: "Audit status and certification posture",
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
};

export function MainContent({ activeSection, pulseOverviewData }: MainContentProps) {
  const config = sectionConfig[activeSection];

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewContent pulseOverviewData={pulseOverviewData} />;
      case "incidents":
        return <IncidentsContent />;
      case "deployments":
        return <DeploymentsContent />;
      case "traces":
      case "performance":
        return <PerformanceContent />;
      case "metrics":
      case "errors":
        return <ErrorsContent />;
      case "guardrails":
      case "sla":
        return <SlaContent />;
      case "audits":
      case "oncall":
        return <OncallContent />;
      case "systems":
      case "services":
        return <ServicesContent />;
      case "risk_reviews":
        return <RiskReviewsContent />;
      case "postmortems":
        return <PostmortemsContent />;
      case "settings":
        return <SettingsContent />;
      default:
        return <OverviewContent />;
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
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Calendar className="w-4 h-4" />
            <span>Last 24 hours</span>
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>

          {/* Alerts */}
          <button
            type="button"
            className="relative p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Alerts"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
          </button>

          {/* Primary Action */}
          <Button size="sm" className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Report Incident</span>
          </Button>
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
