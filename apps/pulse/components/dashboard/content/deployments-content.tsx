"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Clock, GitBranch, MoreHorizontal, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DeploymentsSurfaceData } from "@/components/dashboard/pulse-types";
import type { DeploymentRouteContext } from "@/components/dashboard/pulse-types";
import type { DeploymentDetailPresenter } from "@/lib/deployment-detail-mapper";
import { EmptyStateNotice } from "@/components/dashboard/content/empty-state-notice";

const defaultDeploymentFrequency = [
  { day: "Mon", deploys: 12 },
  { day: "Tue", deploys: 18 },
  { day: "Wed", deploys: 15 },
  { day: "Thu", deploys: 22 },
  { day: "Fri", deploys: 19 },
  { day: "Sat", deploys: 5 },
  { day: "Sun", deploys: 3 },
];

const defaultDeployments = [
  {
    id: "DEP-1234",
    service: "api-gateway",
    version: "v2.3.1",
    status: "success",
    environment: "production",
    duration: "2m 34s",
    timestamp: "10 min ago",
    author: "Sarah Miller",
    authorInitials: "SM",
    commit: "feat: add rate limiting",
    commitHash: "a3b4c5d",
  },
  {
    id: "DEP-1233",
    service: "user-service",
    version: "v1.8.0",
    status: "success",
    environment: "production",
    duration: "3m 12s",
    timestamp: "45 min ago",
    author: "Mike Chen",
    authorInitials: "MC",
    commit: "fix: resolve auth token refresh",
    commitHash: "f6g7h8i",
  },
  {
    id: "DEP-1232",
    service: "checkout-api",
    version: "v3.1.2",
    status: "failed",
    environment: "staging",
    duration: "1m 45s",
    timestamp: "1 hour ago",
    author: "Lisa Park",
    authorInitials: "LP",
    commit: "chore: update dependencies",
    commitHash: "j9k0l1m",
  },
  {
    id: "DEP-1231",
    service: "notification-service",
    version: "v2.0.5",
    status: "success",
    environment: "production",
    duration: "2m 08s",
    timestamp: "2 hours ago",
    author: "Tom Wilson",
    authorInitials: "TW",
    commit: "feat: add email templates",
    commitHash: "n2o3p4q",
  },
  {
    id: "DEP-1230",
    service: "analytics-api",
    version: "v1.4.0",
    status: "success",
    environment: "production",
    duration: "4m 21s",
    timestamp: "3 hours ago",
    author: "Sarah Miller",
    authorInitials: "SM",
    commit: "feat: add new metrics endpoint",
    commitHash: "r5s6t7u",
  },
  {
    id: "DEP-1229",
    service: "payment-service",
    version: "v2.2.1",
    status: "rollback",
    environment: "production",
    duration: "5m 12s",
    timestamp: "4 hours ago",
    author: "Mike Chen",
    authorInitials: "MC",
    commit: "feat: add Apple Pay support",
    commitHash: "v8w9x0y",
  },
];

const defaultMetrics = [
  { label: "Deploys Today", value: "8", change: "+3" },
  { label: "Success Rate", value: "94%", change: "+2%" },
  { label: "Avg Duration", value: "2m 45s", change: "-15s" },
  { label: "Rollbacks", value: "1", change: "0" },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function DeploymentDetailPanel({
  detail,
  error,
}: {
  detail: DeploymentDetailPresenter | null;
  error: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: cardShadow }}>
      {error ? (
        <p className="text-sm text-amber-300">{error}</p>
      ) : !detail ? (
        <p className="text-sm text-muted-foreground">Loading deployment detail…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-foreground">{detail.id}</span>
            <span className="text-muted-foreground">Prompt {detail.promptVersion ?? "n/a"}</span>
            <span className="text-muted-foreground">Model {detail.modelName ?? "n/a"}</span>
            <span className="text-muted-foreground">Env {detail.environment ?? "n/a"}</span>
          </div>
          {detail.gate ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              Gate: {detail.gate.decision} · Risk score {detail.gate.riskScore}
            </div>
          ) : null}
          {detail.intelligence?.graphRiskPatterns.length ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk patterns</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {detail.intelligence.graphRiskPatterns.map((pattern) => (
                  <p key={`${pattern.pattern}-${pattern.traceCount}`}>
                    {pattern.pattern} · {pattern.risk} · {pattern.traceCount} traces
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
            <p>Incidents linked: {detail.incidentIds.length}</p>
            <p>Events: {detail.events.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeploymentsContent({
  deploymentsData,
  deploymentContext,
}: {
  deploymentsData?: DeploymentsSurfaceData;
  deploymentContext?: DeploymentRouteContext;
}) {
  const searchParams = useSearchParams();
  const scopedProjectId = searchParams.get("project_id");
  function withScopedProject(path: string): string {
    if (!scopedProjectId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}project_id=${encodeURIComponent(scopedProjectId)}`;
  }
  const deploymentFrequency =
    deploymentsData?.deploymentFrequency?.length ? deploymentsData.deploymentFrequency : defaultDeploymentFrequency;
  const deployments = deploymentsData?.deployments?.length ? deploymentsData.deployments : defaultDeployments;
  const metrics = deploymentsData?.metrics?.length ? deploymentsData.metrics : defaultMetrics;
  const selectedDeploymentId = deploymentContext?.selectedDeploymentId;
  const [detail, setDetail] = useState<DeploymentDetailPresenter | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const sourceErrorText =
    deploymentsData && deploymentsData.sourceErrors.length > 0
      ? `Data source unavailable: ${deploymentsData.sourceErrors.join(", ")}.`
      : null;

  useEffect(() => {
    if (deploymentContext?.mode !== "detail" || !selectedDeploymentId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/deployments/${selectedDeploymentId}/detail`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setDetail(null);
          setDetailError("Deployment detail unavailable.");
          return;
        }
        setDetail(data as DeploymentDetailPresenter);
        setDetailError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setDetailError("Deployment detail unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [deploymentContext?.mode, selectedDeploymentId]);

  if (deploymentsData && !deploymentsData.hasDeploymentData) {
    return (
      <div className="space-y-4">
        {sourceErrorText ? (
          <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {sourceErrorText}
          </div>
        ) : null}
        <EmptyStateNotice message="No deployments found. Add deployment metadata to correlate regressions with releases." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deploymentContext?.mode === "detail" ? (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Deployment detail route selected{selectedDeploymentId ? ` (${selectedDeploymentId})` : ""}.
        </div>
      ) : null}
      {sourceErrorText ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {sourceErrorText}
        </div>
      ) : null}
      {deploymentContext?.mode === "detail" ? (
        <DeploymentDetailPanel detail={detail} error={detailError} />
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
              <span className="text-sm text-success font-medium">{metric.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Deploy Frequency Chart */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Deployment Frequency</h3>
            <p className="text-sm text-muted-foreground">Deploys per day this week</p>
          </div>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={deploymentFrequency}>
              <defs>
                <linearGradient id="deployGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.15 155)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.15 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
              <XAxis 
                dataKey="day" 
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
                dataKey="deploys"
                stroke="oklch(0.65 0.15 155)"
                strokeWidth={2}
                fill="url(#deployGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Deployments */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Recent Deployments</h3>
        </div>
        <div className="divide-y divide-border">
          {deployments.map((deploy) => (
            <div
              key={deploy.id}
              className={cn(
                "p-4 hover:bg-muted/30 transition-colors",
                selectedDeploymentId === deploy.id ? "bg-primary/5" : "",
              )}
            >
              <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  deploy.status === "success" 
                    ? "bg-success/10"
                    : deploy.status === "failed"
                      ? "bg-destructive/10"
                      : "bg-warning/10"
                )}>
                  {deploy.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : deploy.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Rocket className="w-5 h-5 text-warning" />
                  )}
                </div>

                {/* Service Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{deploy.service}</span>
                    <span className="text-xs font-mono text-muted-foreground">{deploy.version}</span>
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded-full",
                      deploy.environment === "production"
                        ? "bg-chart-1/10 text-chart-1"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {deploy.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="w-3 h-3" />
                    <span className="truncate">{deploy.commit}</span>
                    <span className="font-mono text-xs">({deploy.commitHash})</span>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{deploy.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-chart-1/20 flex items-center justify-center text-xs font-medium text-chart-1">
                      {deploy.authorInitials}
                    </div>
                    <span className="text-muted-foreground">{deploy.author}</span>
                  </div>
                  <span className="text-muted-foreground w-24 text-right">{deploy.timestamp}</span>
                  <div className="flex items-center gap-2">
                    <Link href={withScopedProject(`/deployments/${deploy.id}`)} className="text-xs text-primary hover:underline">
                      Detail
                    </Link>
                    <button type="button" className="p-1 hover:bg-muted rounded-lg">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
