import Link from "next/link";
import { CheckCheck, ShieldAlert, ShieldCheck, ShieldEllipsis } from "lucide-react";

import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Card } from "@/components/ui/card";
import { MetadataBar, MetadataItem } from "@/components/ui/metadata-bar";
import {
  getApiHealth,
  getDashboardChanges,
  getDashboardTriage,
  getOrganization,
  getOrganizationUsageQuota,
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function deliveryTone(status: string | null | undefined) {
  if (status === "sent") return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30";
  if (status === "failed") return "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30";
  if (status === "suppressed") return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30";
  return "bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/20";
}

export default async function DashboardPage() {
  const session = await requireOperatorSession();
  const activeOrganizationId = session.active_organization_id;
  const health = await getApiHealth().catch(() => ({ status: "degraded" }));
  const triage = await getDashboardTriage().catch(() => null);
  const changesFeed = await getDashboardChanges().catch(() => ({ changes: [] }));
  const usageQuota = activeOrganizationId
    ? await getOrganizationUsageQuota(activeOrganizationId).catch(() => null)
    : null;
  const organization = activeOrganizationId
    ? await getOrganization(activeOrganizationId).catch(() => null)
    : null;
  const attentionItems = triage?.attention ?? [];
  const recentActivity = triage?.recent_incident_activity ?? [];
  const attentionCount = triage?.context.active_incident_count ?? attentionItems.length;
  const unacknowledgedCount = triage?.context.unacknowledged_incident_count ?? 0;
  const recentAlerts: Array<{
    id: string;
    channel_type: string;
    channel_target: string;
    delivery_status: string;
    attempt_count: number;
    sent_at: string | null;
    created_at: string;
    next_attempt_at: string | null;
  }> = [];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Triage console</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">What needs attention right now</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              Start with active incidents, then review recent changes and jump into the investigation
              surface that matters most.
            </p>
          </div>
          <MetadataBar>
            <MetadataItem
              label="API"
              value={health.status}
              status={health.status === "ok" ? "success" : "critical"}
            />
            <MetadataItem label="Open" value={String(attentionCount)} />
            <MetadataItem label="Ack" value={String(attentionCount - unacknowledgedCount)} />
          </MetadataBar>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Needs attention</p>
                  <h2 className="mt-2 text-lg font-semibold text-ink">
                    {attentionCount === 0
                      ? "All systems within threshold"
                      : `${attentionCount} active incident${attentionCount === 1 ? "" : "s"}`}
                  </h2>
                </div>
                <div className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-steel">
                  {unacknowledgedCount} awaiting acknowledgment
                </div>
              </div>
            </div>

            {attentionItems.length === 0 ? (
              <div className="px-5 py-6 text-sm leading-6 text-steel">
                No active incidents are open. Review recent changes below to confirm the system remains
                stable after the latest deployments.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {attentionItems.slice(0, 8).map((incident) => (
                  <Link
                    key={incident.id}
                    href={incident.path}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-surface-alt lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 text-steel" />
                      <div>
                        <p className="text-sm font-medium text-ink">{incident.title}</p>
                        <p className="mt-1 text-sm text-steel">
                          {incident.project_name} · started {new Date(incident.started_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {incident.acknowledged_at ? (
                        <span className="text-sm text-steel">Acknowledged</span>
                      ) : (
                        <span className="text-sm text-amber-600">Awaiting acknowledgment</span>
                      )}
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          incident.severity === "critical"
                            ? "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30"
                            : incident.severity === "high"
                              ? "bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30"
                              : "bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/20"
                        }`}
                      >
                        {incident.severity}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent incident activity</p>
            {recentActivity.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentActivity.slice(0, 5).map((incident) => (
                  <Link
                    key={incident.id}
                    href={incident.path}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm text-ink transition hover:border-textSecondary"
                  >
                    <div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="mt-1 text-xs text-steel">
                        Resolved {new Date(incident.resolved_at ?? incident.started_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs text-steel">Review</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-steel">
                No recent incident closures. Monitor deployments and guardrail changes as they land.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent changes</p>
            {changesFeed.changes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {changesFeed.changes.slice(0, 6).map((change) => (
                  <Link
                    key={change.id}
                    href={change.path ?? "#"}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm text-ink transition hover:border-textSecondary"
                  >
                    <div>
                      <p className="font-medium">{change.summary}</p>
                      <p className="mt-1 text-xs text-steel">
                        {change.project_name}
                        {change.environment ? ` · ${change.environment}` : ""}
                        {change.actor ? ` · ${change.actor}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-steel">{new Date(change.created_at).toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-steel">
                No recent deployment, prompt, or model changes detected.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Investigation entry points</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Link
                href={triage?.investigation_links.traces ?? "/traces"}
                className="rounded-lg border border-line bg-surface-alt px-3 py-3 text-sm text-ink transition hover:border-textSecondary"
              >
                <p className="font-medium">Trace explorer</p>
                <p className="mt-1 text-xs text-steel">Inspect retrieval failures and latency spikes.</p>
              </Link>
              <Link
                href={triage?.investigation_links.incidents ?? "/incidents"}
                className="rounded-lg border border-line bg-surface-alt px-3 py-3 text-sm text-ink transition hover:border-textSecondary"
              >
                <p className="font-medium">Incident queue</p>
                <p className="mt-1 text-xs text-steel">Review open and recently resolved incidents.</p>
              </Link>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">System state</p>
            <div className="mt-4 space-y-2 text-sm text-steel">
              <div className="flex items-center justify-between">
                <span>API status</span>
                <span className="font-medium capitalize text-ink">{health.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Open incidents</span>
                <span className="font-medium text-ink">{attentionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Awaiting ack</span>
                <span className="font-medium text-ink">{unacknowledgedCount}</span>
              </div>
            </div>
          </Card>

          {usageQuota?.usage_status && organization ? (
            <UsageMeter
              usageStatus={usageQuota.usage_status}
              plan={organization.plan}
              upgradePrompt={usageQuota.upgrade_prompt ?? null}
              organizationId={organization.id}
            />
          ) : null}

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent alert deliveries</p>
            <div className="mt-4 text-sm leading-6 text-steel">
              Alert deliveries remain available in incident detail views until dashboard-level delivery
              summaries are wired to a dedicated contract.
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
