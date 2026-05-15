"use client";

import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { TracesSurfaceData } from "@/components/dashboard/pulse-types";
import type { TraceRouteContext } from "@/components/dashboard/pulse-types";
import { formatConfidenceLabel, OPERATOR_INTELLIGENCE_COPY } from "@/lib/operator-intelligence";

const defaultLatencyData = [
  { time: "00:00", p50: 45, p95: 120, p99: 250 },
  { time: "04:00", p50: 42, p95: 115, p99: 235 },
  { time: "08:00", p50: 58, p95: 145, p99: 298 },
  { time: "12:00", p50: 72, p95: 168, p99: 345 },
  { time: "16:00", p50: 65, p95: 152, p99: 312 },
  { time: "20:00", p50: 48, p95: 125, p99: 268 },
  { time: "Now", p50: 52, p95: 132, p99: 275 },
];

const defaultThroughputData = [
  { time: "00:00", rps: 12400 },
  { time: "04:00", rps: 8200 },
  { time: "08:00", rps: 24500 },
  { time: "12:00", rps: 31200 },
  { time: "16:00", rps: 28900 },
  { time: "20:00", rps: 19800 },
  { time: "Now", rps: 22100 },
];

const defaultMetrics = [
  { label: "P50 Latency", value: "52ms", change: "-8ms", trend: "down", good: true },
  { label: "P95 Latency", value: "132ms", change: "+12ms", trend: "up", good: false },
  { label: "Throughput", value: "22.1k", change: "+2.3k", trend: "up", good: true },
  { label: "Error Rate", value: "0.42%", change: "-0.08%", trend: "down", good: true },
];

const defaultServiceLatencies = [
  { name: "API Gateway", p50: 45, p95: 142, p99: 289, status: "healthy" },
  { name: "Auth Service", p50: 23, p95: 67, p99: 134, status: "healthy" },
  { name: "User Service", p50: 34, p95: 89, p99: 178, status: "healthy" },
  { name: "Payment Service", p50: 89, p95: 245, p99: 512, status: "degraded" },
  { name: "Order Service", p50: 56, p95: 134, p99: 267, status: "healthy" },
  { name: "Notification Service", p50: 12, p95: 34, p99: 67, status: "healthy" },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export type TraceForensicsViewModel = {
  detail: {
    traceId: string;
    requestId: string;
    success: boolean;
    latencyMs: number | null;
    environment: string | null;
    createdAt: string | null;
    modelName: string | null;
    promptVersion: string | null;
    errorType: string | null;
    comparePath: string | null;
    payloadTruncated: boolean;
  };
  findings: Array<{ label: string; detail: string }>;
  compare: { changedBlockCount: number; totalBlockCount: number; baselineTraceId: string | null; baselineRequestId: string | null } | null;
  graph: { nodeCount: number; edgeCount: number; environment: string | null } | null;
};

export function TraceForensicsPanel({
  mode,
  forensics,
  forensicsError,
}: {
  mode: Exclude<TraceRouteContext["mode"], "list">;
  forensics: TraceForensicsViewModel | null;
  forensicsError: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: cardShadow }}>
      {forensicsError ? (
        <p className="text-sm text-amber-300">{forensicsError}</p>
      ) : forensics ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-foreground">{forensics.detail.requestId}</span>
            <span className="text-muted-foreground">Latency {forensics.detail.latencyMs ?? "—"} ms</span>
            <span className="text-muted-foreground">Model {forensics.detail.modelName ?? "—"}</span>
            <span className="text-muted-foreground">Env {forensics.detail.environment ?? "—"}</span>
          </div>
          {forensics.findings.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-3">
              {forensics.findings.map((finding) => (
                <div key={finding.label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{finding.label}</p>
                  <p className="mt-1 text-sm text-foreground">{finding.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
          {mode === "compare" && forensics.compare ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Changed blocks: {forensics.compare.changedBlockCount}/{forensics.compare.totalBlockCount}
              {forensics.compare.baselineTraceId ? ` · Baseline ${forensics.compare.baselineTraceId}` : ""}
            </div>
          ) : null}
          {mode === "graph" && forensics.graph ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Graph nodes: {forensics.graph.nodeCount} · edges: {forensics.graph.edgeCount}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading trace forensic detail…</p>
      )}
    </div>
  );
}

export function PerformanceContent({
  tracesData,
  traceContext,
}: {
  tracesData?: TracesSurfaceData;
  traceContext?: TraceRouteContext;
}) {
  const latencyData = tracesData?.latencyData?.length ? tracesData.latencyData : defaultLatencyData;
  const throughputData = tracesData?.throughputData?.length ? tracesData.throughputData : defaultThroughputData;
  const metrics = tracesData?.metrics?.length ? tracesData.metrics : defaultMetrics;
  const serviceLatencies = tracesData?.serviceLatencies?.length
    ? tracesData.serviceLatencies
    : defaultServiceLatencies;
  const intelligenceSnippets = tracesData?.intelligenceSnippets ?? [];
  const traceRefs = tracesData?.traceRefs ?? [];
  const selectedTraceRef = traceRefs.find((trace) => trace.id === traceContext?.selectedTraceId) ?? null;
  const [forensics, setForensics] = useState<TraceForensicsViewModel | null>(null);
  const [forensicsError, setForensicsError] = useState<string | null>(null);
  const sourceErrorText =
    tracesData && tracesData.sourceErrors.length > 0
      ? `Data source unavailable: ${tracesData.sourceErrors.join(", ")}.`
      : null;

  useEffect(() => {
    const traceId = traceContext?.selectedTraceId;
    if (!traceId || !traceContext?.mode || traceContext.mode === "list") {
      setForensics(null);
      setForensicsError(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/traces/${traceId}/forensics`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setForensicsError("Trace forensic detail unavailable.");
          setForensics(null);
          return;
        }
        setForensics(data);
        setForensicsError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setForensicsError("Trace forensic detail unavailable.");
        setForensics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [traceContext?.mode, traceContext?.selectedTraceId]);

  if (tracesData && !tracesData.hasTraceData) {
    return (
      <div className="space-y-4">
        {sourceErrorText ? (
          <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {sourceErrorText}
          </div>
        ) : null}
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          No traces yet. Connect your AI system or run your first audit to start monitoring reliability.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {traceContext?.mode && traceContext.mode !== "list" ? (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {traceContext.mode === "detail"
            ? `Trace detail route selected${selectedTraceRef ? ` (${selectedTraceRef.requestId})` : ""}.`
            : traceContext.mode === "compare"
              ? `Trace compare route selected${selectedTraceRef ? ` (${selectedTraceRef.requestId})` : ""}.`
              : `Trace graph route selected${selectedTraceRef ? ` (${selectedTraceRef.requestId})` : ""}.`}
        </div>
      ) : null}
      {sourceErrorText ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {sourceErrorText}
        </div>
      ) : null}
      {traceContext?.mode && traceContext.mode !== "list" ? (
        <TraceForensicsPanel mode={traceContext.mode} forensics={forensics} forensicsError={forensicsError} />
      ) : null}
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-card rounded-2xl p-5 border border-border"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
              <span className={`text-sm font-medium flex items-center gap-1 ${
                metric.good ? "text-success" : "text-destructive"
              }`}>
                {metric.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Latency Chart */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Latency Distribution</h3>
              <p className="text-sm text-muted-foreground">P50, P95, P99 over time (ms)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
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
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
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
                <Line type="monotone" dataKey="p50" stroke="oklch(0.65 0.15 155)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p95" stroke="oklch(0.55 0.18 250)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99" stroke="oklch(0.7 0.18 350)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Chart */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Request Throughput</h3>
              <p className="text-sm text-muted-foreground">Requests per second</p>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputData}>
                <defs>
                  <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="rps"
                  stroke="oklch(0.55 0.18 250)"
                  strokeWidth={2}
                  fill="url(#throughputGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Service Latencies Table */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Recent traces</h3>
          <p className="text-sm text-muted-foreground">Deep-link parity routes for trace detail, compare, and graph.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {traceRefs.length === 0 ? (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                No trace links available
              </span>
            ) : (
              traceRefs.map((trace) => (
                <Link
                  key={trace.id}
                  href={`/traces/${trace.id}`}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    traceContext?.selectedTraceId === trace.id
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {trace.requestId}
                </Link>
              ))
            )}
          </div>
          {selectedTraceRef ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link href={`/traces/${selectedTraceRef.id}/compare`} className="text-primary hover:underline">
                Open compare
              </Link>
              <Link href={`/traces/${selectedTraceRef.id}/graph`} className="text-primary hover:underline">
                Open graph
              </Link>
            </div>
          ) : null}
        </div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Trace intelligence</h3>
            <p className="text-sm text-muted-foreground">{OPERATOR_INTELLIGENCE_COPY.observedContributingFactors}</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {OPERATOR_INTELLIGENCE_COPY.requiresOperatorReview}
          </span>
        </div>
        {intelligenceSnippets.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            Insufficient linked evidence in current trace snapshot.
          </div>
        ) : (
          <div className="space-y-3">
            {intelligenceSnippets.map((snippet) => (
              <div key={snippet.id} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{snippet.title}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {formatConfidenceLabel(snippet.confidence)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {snippet.observedContributingFactors.map((factor) => (
                    <p key={factor} className="text-sm text-muted-foreground">{factor}</p>
                  ))}
                </div>
                {snippet.relatedOperationalSignals.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {OPERATOR_INTELLIGENCE_COPY.relatedOperationalSignals}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {snippet.relatedOperationalSignals.map((signal) => (
                        <p key={signal} className="text-sm text-muted-foreground">{signal}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                  {OPERATOR_INTELLIGENCE_COPY.evidenceReferences}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {snippet.evidenceReferences.map((ref) => (
                    <a
                      key={`${snippet.id}-${ref.label}-${ref.href}`}
                      href={ref.href}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      {ref.label}
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{OPERATOR_INTELLIGENCE_COPY.governanceBoundaryNote}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Latencies Table */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Service Latencies</h3>
          <p className="text-sm text-muted-foreground">Current latency percentiles by service</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Service</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P50</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P95</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P99</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {serviceLatencies.map((service) => (
                <tr key={service.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{service.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p50}ms</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p95}ms</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p99}ms</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      service.status === "healthy"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}>
                      {service.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
