import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Cpu, Globe, Key, Server } from "lucide-react";

import {
  getProject,
  listProjectProcessors,
  createProjectProcessor,
  updateProjectProcessor,
} from "@/lib/api";

export default async function ProjectProcessorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, processorsResponse] = await Promise.all([
    getProject(id).catch(() => null),
    listProjectProcessors(id).catch(() => null),
  ]);

  if (!project || !processorsResponse) {
    notFound();
  }

  const processors = processorsResponse.items;

  async function createProcessorAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const eventType = String(formData.get("event_type") ?? "").trim();
    const endpointUrl = String(formData.get("endpoint_url") ?? "").trim();
    const secret = String(formData.get("secret") ?? "").trim();

    await createProjectProcessor(id, {
      name,
      event_type: eventType,
      endpoint_url: endpointUrl,
      secret,
      enabled: true,
    });

    revalidatePath(`/projects/${id}/processors`);
    revalidatePath(`/projects/${id}`);
    redirect(`/projects/${id}/processors`);
  }

  async function toggleProcessorAction(formData: FormData) {
    "use server";

    const processorId = String(formData.get("processor_id") ?? "");
    const enabled = String(formData.get("enabled") ?? "false") === "true";
    await updateProjectProcessor(id, processorId, { enabled });

    revalidatePath(`/projects/${id}/processors`);
    revalidatePath(`/projects/${id}`);
    redirect(`/projects/${id}/processors`);
  }



  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-sm">
        <div className="border-b border-zinc-800 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-6 py-5">
          <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" />
            Back to project dashboard
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">External processors</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Connect external HTTP endpoints to receive real‑time events from Reliai’s pipeline for custom alerting, logging, or orchestration.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Processors</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{processors.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Active</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{processors.filter(p => p.enabled).length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Event types</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {Array.from(new Set(processors.map(p => p.event_type))).length}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Cpu className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Real‑time forwarding</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Processors receive JSON payloads via HTTP POST within milliseconds of event ingestion.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Key className="mt-0.5 h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Secure delivery</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Each processor includes a secret header for verification; payloads are never stored after delivery.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Register a processor</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Add an external endpoint</h2>
            </div>
          </div>
          <form action={createProcessorAction} className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-zinc-100">Processor name</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Slack alerts"
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="event_type" className="text-sm font-medium text-zinc-100">Event type</label>
              <select
                id="event_type"
                name="event_type"
                required
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                <option value="incident.created">Incident created</option>
                <option value="incident.resolved">Incident resolved</option>
                <option value="regression.detected">Regression detected</option>
                <option value="trace.ingested">Trace ingested</option>
                <option value="guardrail.triggered">Guardrail triggered</option>
              </select>
              <p className="mt-2 text-sm text-zinc-400">
                Which Reliai event should trigger this processor.
              </p>
            </div>

            <div>
              <label htmlFor="endpoint_url" className="text-sm font-medium text-zinc-100">Endpoint URL</label>
              <input
                id="endpoint_url"
                name="endpoint_url"
                type="url"
                required
                placeholder="https://hooks.slack.com/services/..."
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="secret" className="text-sm font-medium text-zinc-100">Secret (for verification)</label>
              <input
                id="secret"
                name="secret"
                type="password"
                required
                placeholder="supersecret"
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                This secret will be sent as an `X‑Processor‑Secret` header.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
            >
              Register processor
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Configured processors</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Active external endpoints</h2>
            </div>
          </div>
          {processors.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900 px-5 py-8 text-sm leading-6 text-zinc-400">
              <p className="text-sm font-medium text-zinc-100">No external processors yet</p>
              <p className="mt-2">
                Add a processor to forward events to Slack, Discord, webhooks, or your own API.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {processors.map((processor) => (
                <div key={processor.id} className="rounded-[22px] border border-zinc-800 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{processor.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">{processor.event_type}</p>
                    </div>
                    <form action={toggleProcessorAction} className="flex items-center gap-2">
                      <input type="hidden" name="processor_id" value={processor.id} />
                      <input type="hidden" name="enabled" value={String(!processor.enabled)} />
                      <button
                        type="submit"
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                          processor.enabled
                            ? "bg-emerald-950 text-emerald-300 ring-emerald-800"
                            : "bg-zinc-900 text-zinc-300 ring-zinc-800"
                        }`}
                      >
                        {processor.enabled ? "enabled" : "disabled"}
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400 break-all">
                    Endpoint: <span className="font-mono text-zinc-300">{processor.endpoint_url}</span>
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-400 md:grid-cols-2">
                    <p>
                      Created: <span className="font-medium text-zinc-100">
                        {new Date(processor.created_at).toLocaleDateString()}
                      </span>
                    </p>
                    <p>
                      Last failure: <span className="font-medium text-zinc-100">
                        {processor.last_failure_at ? new Date(processor.last_failure_at).toLocaleDateString() : "never"}
                      </span>
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-zinc-400">
                      Recent failures: <span className={`font-medium ${processor.recent_failure_count > 0 ? "text-amber-300" : "text-zinc-100"}`}>
                        {processor.recent_failure_count}
                      </span>
                    </p>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}