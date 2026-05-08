import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Bot, PlugZap, ShieldCheck, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  createProjectProcessor,
  getProject,
  listProjectProcessors,
  updateProjectProcessor,
} from "@/lib/api";

function formatTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusTone(enabled: boolean) {
  return enabled
    ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
    : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function failureTone(count: number) {
  if (count > 0) return "text-rose-700";
  return "text-emerald-700";
}

export default async function ProjectProcessorsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, processors] = await Promise.all([
    getProject(projectId).catch(() => null),
    listProjectProcessors(projectId).catch(() => ({ items: [] })),
  ]);

  if (!project) {
    notFound();
  }

  async function registerProcessorAction(formData: FormData) {
    "use server";
    await createProjectProcessor(projectId, {
      name: String(formData.get("name") ?? "").trim(),
      event_type: String(formData.get("event_type") ?? "").trim(),
      endpoint_url: String(formData.get("endpoint_url") ?? "").trim(),
      secret: String(formData.get("secret") ?? "").trim(),
      enabled: formData.get("enabled") === "on",
    });
    revalidatePath(`/projects/${projectId}/processors`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(`/projects/${projectId}/processors`);
  }

  async function enableProcessorAction(formData: FormData) {
    "use server";
    await updateProjectProcessor(projectId, String(formData.get("processor_id")), { enabled: true });
    revalidatePath(`/projects/${projectId}/processors`);
    redirect(`/projects/${projectId}/processors`);
  }

  async function disableProcessorAction(formData: FormData) {
    "use server";
    await updateProjectProcessor(projectId, String(formData.get("processor_id")), { enabled: false });
    revalidatePath(`/projects/${projectId}/processors`);
    redirect(`/projects/${projectId}/processors`);
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.05),rgba(15,23,42,0))] px-6 py-5">
          <Link href={`/projects/${projectId}/control`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to control panel
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Project processors</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Deliver trace and evaluation events to external HTTP processors with deterministic signing,
                bounded retries, and a visible failure ledger.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Processors</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{processors.items.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Enabled</p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {processors.items.filter((item) => item.enabled).length}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Recent failures</p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {processors.items.reduce((sum, item) => sum + item.recent_failure_count, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-ink">Signed delivery</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                Every outbound request includes `X-Reliai-Signature` and `X-Reliai-Event-Type` so downstream
                processors can verify source and intent.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-ink">Failure handling</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                Delivery retries three times before Reliai records the event in the processor failure DLQ.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.92fr)_minmax(0,1.08fr)]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <PlugZap className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Register endpoint</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">New processor</h2>
            </div>
          </div>
          <form action={registerProcessorAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">Name</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                placeholder="Slack enrichment hook"
              />
            </div>
            <div>
              <label htmlFor="event_type" className="text-sm font-medium text-ink">Event type</label>
              <select
                id="event_type"
                name="event_type"
                defaultValue="trace_ingested"
                className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              >
                <option value="trace_ingested">trace_ingested</option>
                <option value="trace_evaluated">trace_evaluated</option>
              </select>
            </div>
            <div>
              <label htmlFor="endpoint_url" className="text-sm font-medium text-ink">Endpoint URL</label>
              <input
                id="endpoint_url"
                name="endpoint_url"
                type="url"
                required
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                placeholder="https://processor.acme.test/ingest"
              />
            </div>
            <div>
              <label htmlFor="secret" className="text-sm font-medium text-ink">Signing secret</label>
              <input
                id="secret"
                name="secret"
                required
                minLength={8}
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                placeholder="processor-shared-secret"
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-ink">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
              Enable processor immediately
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Register processor
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Registered endpoints</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Processor inventory</h2>
            </div>
          </div>
          {processors.items.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-sm leading-6 text-steel">
              No external processors are registered for this project yet. Add an endpoint to fan trace or
              evaluation events into downstream automation, enrichment, or custom storage.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {processors.items.map((processor) => (
                <div key={processor.id} className="rounded-[24px] border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-ink">{processor.name}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(processor.enabled)}`}>
                          {processor.enabled ? "enabled" : "disabled"}
                        </span>
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                          {processor.event_type}
                        </span>
                      </div>
                      <p className="mt-2 break-all text-sm text-steel">{processor.endpoint_url}</p>
                    </div>
                    <form action={processor.enabled ? disableProcessorAction : enableProcessorAction}>
                      <input type="hidden" name="processor_id" value={processor.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-zinc-500"
                      >
                        {processor.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-steel">Created</p>
                      <p className="mt-2 text-sm font-medium text-ink">{formatTime(processor.created_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-steel">Recent failures</p>
                      <p className={`mt-2 text-sm font-medium ${failureTone(processor.recent_failure_count)}`}>
                        {processor.recent_failure_count}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-steel">Last failure</p>
                      <p className="mt-2 text-sm font-medium text-ink">{formatTime(processor.last_failure_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
