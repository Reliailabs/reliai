"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Clock, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PulseOverviewData } from "@/components/dashboard/pulse-types";

const recentActivity = [
  {
    id: 1,
    type: "incident",
    title: "Database latency spike",
    time: "2 min ago",
    status: "active",
  },
  {
    id: 2,
    type: "deploy",
    title: "api-gateway v2.3.1",
    time: "15 min ago",
    status: "success",
  },
  {
    id: 3,
    type: "incident",
    title: "Auth service 503",
    time: "1 hour ago",
    status: "resolved",
  },
  {
    id: 4,
    type: "deploy",
    title: "user-service v1.8.0",
    time: "2 hours ago",
    status: "success",
  },
  {
    id: 5,
    type: "incident",
    title: "CDN cache miss",
    time: "3 hours ago",
    status: "resolved",
  },
];

const oncallTeam = [
  {
    id: 1,
    name: "Sarah Miller",
    role: "Primary On-Call",
    initials: "SM",
    status: "active",
  },
  {
    id: 2,
    name: "Mike Chen",
    role: "Secondary On-Call",
    initials: "MC",
    status: "standby",
  },
  {
    id: 3,
    name: "Lisa Park",
    role: "Platform Lead",
    initials: "LP",
    status: "available",
  },
  {
    id: 4,
    name: "Tom Wilson",
    role: "SRE Engineer",
    initials: "TW",
    status: "available",
  },
];

export function RightPanel({ pulseOverviewData }: { pulseOverviewData?: PulseOverviewData }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectScope = searchParams.get("project_id") ?? searchParams.get("projectId");
  const settingsTeamHref = projectScope
    ? `/settings?project_id=${encodeURIComponent(projectScope)}#team`
    : "/settings#team";
  const recentActivityItems = pulseOverviewData?.recentActivity ?? recentActivity;
  const [responseTeam, setResponseTeam] = useState(oncallTeam);
  const [teamLoading, setTeamLoading] = useState(true);
  const areiScore = pulseOverviewData?.areiScore ?? 62;
  const deltaValue = pulseOverviewData?.areiDelta;
  const deltaLabel = deltaValue == null ? "n/a" : `${deltaValue >= 0 ? "+" : ""}${deltaValue}`;
  const stable = areiScore < 50;

  useEffect(() => {
    let mounted = true;
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    const projectId = projectMatch?.[1] ?? searchParams.get("project_id") ?? searchParams.get("projectId") ?? undefined;
    const endpoint = projectId
      ? `/api/oncall/response-team?project_id=${encodeURIComponent(projectId)}`
      : "/api/oncall/response-team";

    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { items?: typeof oncallTeam };
      })
      .then((payload) => {
        if (!mounted) return;
        if (payload?.items && payload.items.length > 0) {
          setResponseTeam(payload.items);
        } else {
          setResponseTeam([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setResponseTeam([]);
      })
      .finally(() => {
        if (mounted) setTeamLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [pathname, searchParams]);

  return (
    <aside className="w-[280px] h-screen bg-card border-l border-border flex flex-col shrink-0 overflow-hidden">
      {/* Reliability Status */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Reliability Status</h3>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${stable ? "text-success" : "text-warning"}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${stable ? "bg-success" : "bg-warning"}`} />
            {stable ? "Stable" : "Elevated"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">AREI</p>
            <p className="text-lg font-semibold text-foreground">{areiScore}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Risk Delta</p>
            <p className="text-lg font-semibold text-foreground">{deltaLabel}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          Reliability Timeline
        </h3>
        <div className="space-y-3">
          {recentActivityItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                item.status === "active" 
                  ? "bg-destructive/10" 
                  : item.status === "success" 
                    ? "bg-success/10" 
                    : "bg-muted"
              )}>
                {item.type === "incident" ? (
                  item.status === "active" ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-success" />
                  )
                ) : item.status === "success" ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* On-Call Team */}
      <div className="p-5 flex-1 overflow-y-auto">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Response Team
        </h3>
        {teamLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : responseTeam.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>No response team configured.</p>
            <Link href={settingsTeamHref} className="mt-2 inline-flex text-xs text-foreground underline underline-offset-2">
              Configure team members
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {responseTeam.map((member) => (
              <button
                key={member.id}
                type="button"
                className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
              >
                <div className="relative">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium",
                      member.status === "active"
                        ? "bg-chart-1/20 text-chart-1"
                        : member.status === "standby"
                          ? "bg-warning/20 text-warning"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {member.initials}
                  </div>
                  {member.status === "active" && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.role}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
