import { AlertTriangle, Clock3, FolderKanban, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getApiHealth } from "@/lib/api";

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
    </div>
  );
}
