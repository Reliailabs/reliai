import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ArrowLeft,
  BellRing,
  CheckCheck,
  Clock3,
  FolderKanban,
  GitCompareArrows,
  ScanSearch,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  acknowledgeIncident,
  assignIncidentOwner,
  getIncidentAlerts,
  getIncidentDetail,
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function deliveryTone(status: string) {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (status === "suppressed") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function IncidentDetailPage({
  params
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const session = await requireOperatorSession();
  const { incidentId } = await params;
  const [incident, alerts] = await Promise.all([
    getIncidentDetail(incidentId).catch(() => null),
    getIncidentAlerts(incidentId).catch(() => ({ items: [] }))
  ]);

  if (!incident) {
    notFound();
  }

  async function acknowledgeAction() {
    "use server";
    await acknowledgeIncident(incidentId);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function assignToMeAction() {
    "use server";
    await assignIncidentOwner(incidentId, session.operator.id);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function clearOwnerAction() {
    "use server";
    await assignIncidentOwner(incidentId, null);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/incidents" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to incidents
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">{incident.title}</h1>
          <p className="mt-2 text-sm text-steel">
            {incident.project_name} · opened {new Date(incident.started_at).toLocaleString()}
          </p>
        </div>
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
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <FolderKanban className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Project</p>
          <p className="mt-2 text-xl font-semibold text-ink">{incident.project_name}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <GitCompareArrows className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Metric</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.metric_name ?? "n/a")}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Clock3 className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Window</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.window_minutes ?? "n/a")} min
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <ScanSearch className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Scope</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}
          </p>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Regression comparison</p>
            {incident.regressions.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-[0.18em] text-steel">
                    <tr>
                      <th className="px-4 py-3 font-medium">Metric</th>
                      <th className="px-4 py-3 font-medium">Current</th>
                      <th className="px-4 py-3 font-medium">Baseline</th>
                      <th className="px-4 py-3 font-medium">Delta</th>
                      <th className="px-4 py-3 font-medium">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.regressions.map((regression) => (
                      <tr key={regression.id} className="border-t border-zinc-200">
                        <td className="px-4 py-3 text-sm font-medium text-ink">{regression.metric_name}</td>
                        <td className="px-4 py-3 text-sm text-steel">{regression.current_value}</td>
                        <td className="px-4 py-3 text-sm text-steel">{regression.baseline_value}</td>
                        <td className="px-4 py-3 text-sm text-steel">
                          {regression.delta_absolute}
                          {regression.delta_percent ? ` (${regression.delta_percent})` : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-steel">
                          {new Date(regression.detected_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No regression snapshots are attached to this incident.
              </p>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Linked traces</p>
            {incident.traces.length > 0 ? (
              <div className="mt-4 space-y-3">
                {incident.traces.map((trace) => (
                  <Link
                    key={trace.id}
                    href={`/traces/${trace.id}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                      <p className="mt-1 text-sm text-steel">
                        {new Date(trace.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-sm text-steel">
                      <p>{trace.success ? "Success" : trace.error_type ?? "Failure"}</p>
                      <p className="mt-1">
                        {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No trace samples were attached to this incident.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Operator actions</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">Acknowledgment</p>
                <p className="mt-2 text-sm text-steel">
                  {incident.acknowledged_at
                    ? `Acknowledged by ${incident.acknowledged_by_operator_email ?? "operator"} at ${new Date(
                        incident.acknowledged_at
                      ).toLocaleString()}`
                    : "Not acknowledged yet"}
                </p>
                {!incident.acknowledged_at ? (
                  <form action={acknowledgeAction} className="mt-3">
                    <Button size="sm">
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Acknowledge
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">Owner</p>
                <p className="mt-2 text-sm text-steel">
                  {incident.owner_operator_email ?? "Unassigned"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.owner_operator_user_id !== session.operator.id ? (
                    <form action={assignToMeAction}>
                      <Button size="sm" variant="outline">
                        <UserRound className="mr-2 h-4 w-4" />
                        Assign to me
                      </Button>
                    </form>
                  ) : null}
                  {incident.owner_operator_user_id ? (
                    <form action={clearOwnerAction}>
                      <Button size="sm" variant="subtle">
                        Clear owner
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Alert deliveries</p>
            {alerts.items.length > 0 ? (
              <div className="mt-4 space-y-3">
                {alerts.items.map((alert) => (
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
                    {alert.error_message ? (
                      <p className="mt-2 text-sm text-rose-700">{alert.error_message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm leading-6 text-steel">
                <BellRing className="mb-3 h-5 w-5" />
                No alert deliveries have been recorded for this incident yet.
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident summary</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-ink">
              {JSON.stringify(incident.summary_json, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
