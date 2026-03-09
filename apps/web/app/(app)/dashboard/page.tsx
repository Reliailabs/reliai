import Link from "next/link";
import { AlertTriangle, Clock3, FolderKanban, ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getApiHealth, listIncidents } from "@/lib/api";

const summaryCards = [
  {
    label: "API status",
    value: "Connected",
    note: "FastAPI health endpoint is wired",
    icon: ShieldCheck
  },
  {
    label: "Projects",
    value: "0 active",
    note: "Create the first project to enable ingest",
    icon: FolderKanban
  },
  {
    label: "Trace explorer",
    value: "Ready",
    note: "Filter recent requests by project, model, prompt, and outcome",
    icon: AlertTriangle
  },
  {
    label: "Structured validity",
    value: "Queued",
    note: "RQ worker persists the first evaluation scaffold after ingest",
    icon: Clock3
  }
];

export default async function DashboardPage() {
  const health = await getApiHealth().catch(() => ({ status: "degraded" }));
  const incidents = await listIncidents({ status: "open", limit: 5 }).catch(() => ({ items: [] }));
  const criticalCount = incidents.items.filter((incident) => incident.severity === "critical").length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-white px-6 py-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Overview</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Operator dashboard shell</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              The current slice covers tenant setup, project registration, API key issuance, trace
              inspection, retrieval metadata capture, and one deterministic evaluation path.
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
                  <p className="mt-3 text-2xl font-semibold">{card.value}</p>
                </div>
                <Icon className="h-5 w-5 text-steel" />
              </div>
              <p className="mt-4 text-sm leading-6 text-steel">{card.note}</p>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        <div className="border-b border-zinc-200 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Active incidents</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {incidents.items.length} open incident{incidents.items.length === 1 ? "" : "s"}
              </h2>
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
              {criticalCount} critical
            </div>
          </div>
        </div>

        {incidents.items.length === 0 ? (
          <div className="px-6 py-10 text-sm leading-6 text-steel">
            No active incidents are open. Once the fixed threshold rules detect a structured output,
            success, latency, or cost regression, the operator queue will appear here.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {incidents.items.map((incident) => (
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
                  <span className="text-sm text-steel">Open incident</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
