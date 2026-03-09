import Link from "next/link";
import { AlertTriangle, ArrowRight, FolderKanban, SearchSlash } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listIncidents } from "@/lib/api";

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function IncidentsPage() {
  const incidents = await listIncidents({ limit: 50 }).catch(() => ({ items: [] }));
  const activeCount = incidents.items.filter((incident) => incident.status === "open").length;

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incidents</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Deterministic reliability incidents
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Threshold breaches open incidents from persisted regression snapshots. Each incident
              is deduped by a stable fingerprint and links back to concrete traces.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {activeCount} open · {incidents.items.length - activeCount} resolved
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        {incidents.items.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
              <SearchSlash className="h-6 w-6 text-steel" />
              <h2 className="mt-4 text-xl font-semibold text-ink">No incidents yet</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-steel">
                Incidents appear after traces accumulate enough baseline and current-window volume
                for the fixed structured validity, success, latency, and cost rules.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {incidents.items.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="grid gap-4 px-6 py-5 transition hover:bg-zinc-50 lg:grid-cols-[minmax(0,1.5fr)_180px_160px_220px_24px] lg:items-center"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityTone(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        incident.status === "open"
                          ? "bg-ink text-white"
                          : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink">{incident.title}</p>
                  <p className="mt-2 text-sm text-steel">{incident.project_name}</p>
                </div>
                <div className="text-sm text-steel">
                  <p className="inline-flex items-center gap-2 text-ink">
                    <FolderKanban className="h-4 w-4 text-steel" />
                    {incident.project_name}
                  </p>
                </div>
                <div className="text-sm text-steel">
                  <p className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {String(incident.summary_json.metric_name ?? "metric")}
                  </p>
                </div>
                <div className="text-sm text-steel">
                  Started {new Date(incident.started_at).toLocaleString()}
                </div>
                <ArrowRight className="h-4 w-4 text-steel" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
