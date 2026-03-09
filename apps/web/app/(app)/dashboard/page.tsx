import Link from "next/link";
import { BellRing, CheckCheck, ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getApiHealth, listIncidents } from "@/lib/api";

function deliveryTone(status: string | null | undefined) {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (status === "suppressed") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function DashboardPage() {
  const health = await getApiHealth().catch(() => ({ status: "degraded" }));
  const incidents = await listIncidents({ limit: 50 }).catch(() => ({ items: [] }));
  const activeIncidents = incidents.items.filter((incident) => incident.status === "open");
  const unacknowledgedIncidents = activeIncidents.filter((incident) => incident.acknowledged_at === null);
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
      label: "Active incidents",
      value: String(activeIncidents.length),
      note: "Currently open incidents waiting on operator review",
      icon: ShieldAlert
    },
    {
      label: "Unacknowledged",
      value: String(unacknowledgedIncidents.length),
      note: "Open incidents without an operator acknowledgment",
      icon: CheckCheck
    },
    {
      label: "Recent alerts",
      value: String(recentAlerts.length),
      note: "Latest alert delivery attempts across recent incidents",
      icon: BellRing
    }
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-white px-6 py-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Overview</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Incident and alert operations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              Monitor open incidents, confirm operator acknowledgment, and inspect the latest Slack
              alert delivery attempts without leaving the dashboard.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            API status: <span className="font-medium text-ink">{health.status}</span>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="overflow-hidden rounded-[28px] border-zinc-300">
          <div className="border-b border-zinc-200 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Active incidents</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {activeIncidents.length} open incident{activeIncidents.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
                {unacknowledgedIncidents.length} unacknowledged
              </div>
            </div>
          </div>

          {activeIncidents.length === 0 ? (
            <div className="px-6 py-10 text-sm leading-6 text-steel">
              No active incidents are open. New incidents will appear here when deterministic
              regression rules breach and enter the operator queue.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {activeIncidents.slice(0, 8).map((incident) => (
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
                    {alert.sent_at
                      ? `Sent ${new Date(alert.sent_at).toLocaleString()}`
                      : `Created ${new Date(alert.created_at).toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm leading-6 text-steel">
              No alert deliveries have been recorded yet. When a new incident opens, the first Slack
              delivery attempt will appear here.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
