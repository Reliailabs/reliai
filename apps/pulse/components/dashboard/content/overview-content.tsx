"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Link2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { CausalityEvidenceData, PulseOverviewData } from "@/components/dashboard/pulse-types";
import type { AttributionSuggestionData } from "@/components/dashboard/pulse-types";
import Link from "next/link";
import { OPERATOR_INTELLIGENCE_COPY } from "@/lib/operator-intelligence";

const defaultRequestsData = [
  { time: "00:00", requests: 12400, errors: 45 },
  { time: "04:00", requests: 8200, errors: 23 },
  { time: "08:00", requests: 24500, errors: 89 },
  { time: "12:00", requests: 31200, errors: 124 },
  { time: "16:00", requests: 28900, errors: 98 },
  { time: "20:00", requests: 19800, errors: 67 },
  { time: "Now", requests: 22100, errors: 72 },
];

const latencyData = [
  { service: "Support Copilot", p50: 45, p95: 142, p99: 289 },
  { service: "RAG Search", p50: 23, p95: 67, p99: 134 },
  { service: "Agent Routing", p50: 12, p95: 34, p99: 78 },
  { service: "Safety Filter", p50: 2, p95: 8, p99: 15 },
  { service: "Checkout Assistant", p50: 18, p95: 45, p99: 92 },
];

const defaultMetrics = [
  {
    label: "Active Incidents",
    value: "3",
    change: "+2",
    trend: "up",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    label: "Regression Detections",
    value: "8",
    change: "+3",
    trend: "up",
    icon: Zap,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  {
    label: "Failed Evals",
    value: "42",
    change: "-0.12%",
    trend: "down",
    icon: Activity,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    label: "High-Risk Outputs",
    value: "17",
    change: "+4",
    trend: "up",
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success/10",
  },
];

const defaultActiveIncidents = [
  {
    id: "INC-2847",
    title: "Database latency spike in us-east-1",
    severity: "high",
    duration: "23 min",
    assignee: "Sarah M.",
  },
  {
    id: "INC-2846",
    title: "Payment gateway timeout errors",
    severity: "critical",
    duration: "45 min",
    assignee: "Mike C.",
  },
  {
    id: "INC-2845",
    title: "CDN cache invalidation delay",
    severity: "medium",
    duration: "1h 12m",
    assignee: "Lisa P.",
  },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function OverviewContent({
  pulseOverviewData,
  causalityEvidenceData,
  attributionSuggestionsData,
}: {
  pulseOverviewData?: PulseOverviewData;
  causalityEvidenceData?: CausalityEvidenceData;
  attributionSuggestionsData?: AttributionSuggestionData;
}) {
  const formatConfidence = (value: string) => (value === "insufficient" ? "insufficient data" : value);
  const metricDecor: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
    "Active Incidents": { icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
    "Regression Detections": { icon: Zap, color: "text-chart-1", bgColor: "bg-chart-1/10" },
    "Failed Evals": { icon: Activity, color: "text-success", bgColor: "bg-success/10" },
    "High-Risk Outputs": { icon: CheckCircle, color: "text-success", bgColor: "bg-success/10" },
  };
  const metrics = pulseOverviewData?.metrics
    ? pulseOverviewData.metrics.map((metric) => ({
        ...metric,
        ...(metricDecor[metric.label] ?? metricDecor["High-Risk Outputs"]),
      }))
    : defaultMetrics;
  const activeIncidents = pulseOverviewData?.activeIncidents ?? defaultActiveIncidents;
  const requestsData = pulseOverviewData?.timelinePoints ?? defaultRequestsData;
  const sourceErrorText =
    pulseOverviewData && pulseOverviewData.sourceErrors.length > 0
      ? `Data source unavailable: ${pulseOverviewData.sourceErrors.join(", ")}.`
      : null;
  const causalitySourceErrorText =
    causalityEvidenceData && causalityEvidenceData.sourceErrors.length > 0
      ? `Data source unavailable: ${causalityEvidenceData.sourceErrors.join(", ")}.`
      : null;
  const attributionSourceErrorText =
    attributionSuggestionsData && attributionSuggestionsData.sourceErrors.length > 0
      ? `Data source unavailable: ${attributionSuggestionsData.sourceErrors.join(", ")}.`
      : null;
  const dataMode = pulseOverviewData?.dataMode ?? "live";
  const dataModeLabel = dataMode === "demo" ? "Demo data" : "Live data";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pulse signal state</p>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          Data mode: {dataModeLabel}
        </span>
      </div>
      {sourceErrorText ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {sourceErrorText}
        </div>
      ) : null}
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-card rounded-2xl p-5 border border-border"
              style={{ boxShadow: cardShadow }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${metric.bgColor}`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  metric.trend === "down" && metric.label !== "Error Rate"
                    ? "text-destructive"
                    : metric.trend === "down" && metric.label === "Error Rate"
                      ? "text-success"
                      : metric.label === "Active Incidents"
                        ? "text-destructive"
                        : "text-success"
                }`}>
                  {metric.trend === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">{metric.change}</span>
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground mb-1">
                {metric.value}
              </p>
              <p className="text-sm text-muted-foreground">{metric.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Requests Chart */}
        <div
          className="col-span-2 bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Reliability Timeline</h3>
              <p className="text-sm text-muted-foreground">Signals over time</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-1" />
                <span className="text-muted-foreground">Reliability signals</span>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={requestsData}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <YAxis 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid oklch(0.92 0.005 250)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="oklch(0.55 0.18 250)"
                  strokeWidth={2}
                  fill="url(#requestsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Incidents */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Active Incidents</h3>
            <span className="px-2 py-1 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
              {activeIncidents.length} open
            </span>
          </div>
          <div className="space-y-3">
            {activeIncidents.map((incident) => (
              <div
                key={incident.id}
                className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                    incident.severity === "critical"
                      ? "bg-destructive/20 text-destructive"
                      : incident.severity === "high"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted-foreground/20 text-muted-foreground"
                  }`}>
                    {incident.severity}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{incident.id}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">
                  {incident.title}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {incident.duration}
                  </div>
                  <span>{incident.assignee}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Latency */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Model and Workflow Drift</h3>
            <p className="text-sm text-muted-foreground">P50, P95, P99 response shift by workflow</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-2" />
              <span className="text-muted-foreground">P50</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-1" />
              <span className="text-muted-foreground">P95</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-chart-3" />
              <span className="text-muted-foreground">P99</span>
            </div>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={latencyData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" horizontal={false} />
              <XAxis 
                type="number" 
                tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
              />
              <YAxis 
                dataKey="service" 
                type="category"
                tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid oklch(0.92 0.005 250)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Bar dataKey="p50" fill="oklch(0.65 0.15 155)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="p95" fill="oklch(0.55 0.18 250)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="p99" fill="oklch(0.7 0.18 350)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Read-only causality evidence */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Deployment Causality Evidence</h3>
            <p className="text-sm text-muted-foreground">
              Read-only evidence layer. Likely related changes require operator review.
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {OPERATOR_INTELLIGENCE_COPY.requiresOperatorReview}
          </span>
        </div>

        {causalitySourceErrorText ? (
          <div className="mt-4 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {causalitySourceErrorText}
          </div>
        ) : null}

        {causalityEvidenceData?.items?.length ? (
          <div className="mt-4 space-y-3">
            {causalityEvidenceData.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Confidence: {formatConfidence(item.confidence)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <p>Evidence window: {item.evidenceWindow}</p>
                  <p>Observed before degradation: {item.observedBeforeDegradation}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.links.map((link) => (
                    <Link
                      key={`${item.id}-${link.href}`}
                      href={link.href}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No likely related change identified in the current evidence window.
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{OPERATOR_INTELLIGENCE_COPY.governanceBoundaryNote}</p>
      </div>

      {/* Advisory attribution suggestions */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Attribution Suggestions (Advisory)</h3>
            <p className="text-sm text-muted-foreground">
              Likely related surfaces based on observed evidence. Requires operator review.
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {OPERATOR_INTELLIGENCE_COPY.requiresOperatorReview}
          </span>
        </div>

        {attributionSourceErrorText ? (
          <div className="mt-4 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {attributionSourceErrorText}
          </div>
        ) : null}

        {attributionSuggestionsData?.items?.length ? (
          <div className="mt-4 space-y-3">
            {attributionSuggestionsData.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Confidence: {formatConfidence(item.confidence)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground/90">{item.suggestion}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.links.map((link) => (
                    <Link
                      key={`${item.id}-${link.href}`}
                      href={link.href}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No advisory attribution suggestions for the current evidence window.
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{OPERATOR_INTELLIGENCE_COPY.governanceBoundaryNote}</p>
      </div>
    </div>
  );
}
