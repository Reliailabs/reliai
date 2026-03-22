import Link from "next/link";
import { CheckCheck, ShieldAlert, ShieldCheck, ShieldEllipsis } from "lucide-react";

import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Card } from "@/components/ui/card";
import { MetadataBar, MetadataItem } from "@/components/ui/metadata-bar";
import { getApiHealth, getOrganization, getOrganizationUsageQuota, listIncidents } from "@/lib/api";
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
  const incidents = await listIncidents({ limit: 50 }).catch(() => ({ items: [] }));
  const usageQuota = activeOrganizationId
    ? await getOrganizationUsageQuota(activeOrganizationId).catch(() => null)
    : null;
  const organization = activeOrganizationId
    ? await getOrganization(activeOrganizationId).catch(() => null)
    : null;
  const openIncidents = incidents.items.filter((incident) => incident.status === "open");
  const acknowledgedOpenIncidents = openIncidents.filter((incident) => incident.acknowledged_at !== null);
  const unacknowledgedOpenIncidents = openIncidents.filter((incident) => incident.acknowledged_at === null);
  const resolvedRecentIncidents = incidents.items.filter((incident) => incident.status === "resolved");
  const recentAlerts = incidents.items
    .map((incident) => incident.latest_alert_delivery)
    .filter((delivery): delivery is NonNullable<typeof delivery> => delivery !== null)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);

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
            <MetadataItem label="Open" value={String(openIncidents.length)} />
            <MetadataItem label="Ack" value={String(acknowledgedOpenIncidents.length)} />
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
                    {openIncidents.length === 0
                      ? "All systems within threshold"
                      : `${openIncidents.length} active incident${openIncidents.length === 1 ? "" : "s"}`}
                  </h2>
                </div>
                <div className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-steel">
                  {unacknowledgedOpenIncidents.length} awaiting acknowledgment
                </div>
              </div>
            </div>

            {openIncidents.length === 0 ? (
              <div className="px-5 py-6 text-sm leading-6 text-steel">
                No active incidents are open. Review recent changes below to confirm the system remains
                stable after the latest deployments.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {[...unacknowledgedOpenIncidents, ...acknowledgedOpenIncidents].slice(0, 8).map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
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
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent change vectors</p>
            {resolvedRecentIncidents.length > 0 ? (
              <div className="mt-4 space-y-3">
                {resolvedRecentIncidents.slice(0, 5).map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface-alt px-3 py-2 text-sm text-ink transition hover:border-textSecondary"
                  >
                    <div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="mt-1 text-xs text-steel">
                        Resolved {new Date(incident.resolved_at ?? incident.updated_at).toLocaleString()}
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
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Investigation entry points</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Link
                href="/traces"
                className="rounded-lg border border-line bg-surface-alt px-3 py-3 text-sm text-ink transition hover:border-textSecondary"
              >
                <p className="font-medium">Trace explorer</p>
                <p className="mt-1 text-xs text-steel">Inspect retrieval failures and latency spikes.</p>
              </Link>
              <Link
                href="/incidents"
                className="rounded-lg border border-line bg-surface-alt px-3 py-3 text-sm text-ink transition hover:border-textSecondary"
              >
                <p className="font-medium">Incident queue</p>
                <p className="mt-1 text-xs text-steel">Review open and recently resolved incidents.</p>
              </Link>
              <Link
                href="/system/reliability-patterns"
                className="rounded-lg border border-line bg-surface-alt px-3 py-3 text-sm text-ink transition hover:border-textSecondary"
              >
                <p className="font-medium">Project reliability</p>
                <p className="mt-1 text-xs text-steel">Scan regression patterns and drift signals.</p>
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
                <span className="font-medium text-ink">{openIncidents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Awaiting ack</span>
                <span className="font-medium text-ink">{unacknowledgedOpenIncidents.length}</span>
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
            {recentAlerts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{alert.channel_type}</p>
                        <p className="mt-1 text-sm text-steel">{alert.channel_target}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${deliveryTone(alert.delivery_status)}`}>
                        {alert.delivery_status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-steel">
                      Attempts {alert.attempt_count}
                      {alert.sent_at
                        ? ` · sent ${new Date(alert.sent_at).toLocaleString()}`
                        : ` · created ${new Date(alert.created_at).toLocaleString()}`}
                    </p>
                    {alert.next_attempt_at ? (
                      <p className="mt-2 text-sm text-steel">
                        Next retry {new Date(alert.next_attempt_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm leading-6 text-steel">
                No alert deliveries have been recorded yet. When a new or reopened incident opens,
                its first Slack delivery attempt will appear here.
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
