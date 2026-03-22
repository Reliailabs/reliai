import Link from "next/link";
import { BellRing, CheckCheck, ShieldAlert, ShieldCheck, ShieldEllipsis } from "lucide-react";

import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Card } from "@/components/ui/card";
import { MetadataBar, MetadataItem } from "@/components/ui/metadata-bar";
import { getApiHealth, getOrganization, getOrganizationUsageQuota, listIncidents } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function deliveryTone(status: string | null | undefined) {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (status === "suppressed") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
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

  const summaryCards = [
    {
      label: "API status",
      value: health.status,
      note: "FastAPI operator routes are responding",
      icon: ShieldCheck
    },
    {
      label: "Unresolved",
      value: String(openIncidents.length),
      note: "Incidents currently open in the operator queue",
      icon: ShieldAlert
    },
    {
      label: "Acknowledged",
      value: String(acknowledgedOpenIncidents.length),
      note: "Open incidents with an operator acknowledgment",
      icon: CheckCheck
    },
    {
      label: "Resolved recent",
      value: String(resolvedRecentIncidents.length),
      note: "Recent resolved incidents in the current incident list window",
      icon: ShieldEllipsis
    }
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-white px-6 py-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Overview</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Incident lifecycle operations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              Watch unresolved incidents, confirm acknowledgment coverage, and inspect recent alert
              outcomes from the same deterministic incident queue.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <MetadataBar>
              <MetadataItem
                label="API"
                value={health.status}
                status={health.status === "ok" ? "success" : "critical"}
              />
              <MetadataItem label="Open" value={String(openIncidents.length)} />
              <MetadataItem label="Ack" value={String(acknowledgedOpenIncidents.length)} />
            </MetadataBar>
            {usageQuota?.usage_status && organization ? (
              <UsageMeter
                usageStatus={usageQuota.usage_status}
                plan={organization.plan}
                upgradePrompt={usageQuota.upgrade_prompt ?? null}
                organizationId={organization.id}
              />
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-steel">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold capitalize">{card.value}</p>
                </div>
                <Icon className="h-5 w-5 text-steel" />
              </div>
              <p className="mt-4 text-sm leading-6 text-steel">{card.note}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Queue state</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{openIncidents.length}</p>
          <p className="mt-2 text-sm text-steel">Open incidents waiting on investigation or resolution.</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Awaiting acknowledgment</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{unacknowledgedOpenIncidents.length}</p>
          <p className="mt-2 text-sm text-steel">Open incidents that still need explicit operator acknowledgment.</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent alerts</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{recentAlerts.length}</p>
          <p className="mt-2 text-sm text-steel">Latest delivery rows across incidents, including retries and failures.</p>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="overflow-hidden rounded-[28px] border-zinc-300">
          <div className="border-b border-zinc-200 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Active incidents</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {openIncidents.length} open incident{openIncidents.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
                {unacknowledgedOpenIncidents.length} unacknowledged
              </div>
            </div>
          </div>

          {openIncidents.length === 0 ? (
            <div className="px-6 py-10 text-sm leading-6 text-steel">
              No active incidents are open. New or reopened incidents will appear here when deterministic
              regression rules breach and enter the operator queue.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {openIncidents.slice(0, 8).map((incident) => (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="flex flex-col gap-3 px-6 py-4 transition hover:bg-zinc-50 lg:flex-row lg:items-center lg:justify-between"
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
                      <span className="text-sm text-amber-800">Awaiting acknowledgment</span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        incident.severity === "critical"
                          ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                          : incident.severity === "high"
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                            : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                      }`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent alert deliveries</p>
          {recentAlerts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
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
      </div>
    </div>
  );
}
