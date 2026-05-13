import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getApiAccessToken, requireOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { getProjectProcessorsSurfaceData } from "@/lib/project-processors-data";

type ProjectProcessorsPageProps = {
  params: Promise<{ projectId: string }>;
};

function formatTime(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

export default async function ProjectProcessorsPage({ params }: ProjectProcessorsPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();

  const data = await getProjectProcessorsSurfaceData(projectId);
  const enabledCount = data.processors.filter((item) => item.enabled).length;
  const failureCount = data.processors.reduce((sum, item) => sum + item.recent_failure_count, 0);

  async function createProcessorAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;
    await fetch(`${API_URL}/api/v1/projects/${projectId}/processors`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        event_type: String(formData.get("event_type") ?? "trace_ingested").trim(),
        endpoint_url: String(formData.get("endpoint_url") ?? "").trim(),
        secret: String(formData.get("secret") ?? "").trim(),
        enabled: formData.get("enabled") === "on",
      }),
      cache: "no-store",
    });
    revalidatePath(`/projects/${projectId}/processors`);
    redirect(`/projects/${projectId}/processors`);
  }

  async function updateProcessorAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;
    const processorId = String(formData.get("processor_id") ?? "");
    await fetch(`${API_URL}/api/v1/projects/${projectId}/processors/${processorId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        endpoint_url: String(formData.get("endpoint_url") ?? "").trim(),
        secret: String(formData.get("secret") ?? "").trim() || undefined,
      }),
      cache: "no-store",
    });
    revalidatePath(`/projects/${projectId}/processors`);
    redirect(`/projects/${projectId}/processors`);
  }

  async function toggleProcessorAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;
    const processorId = String(formData.get("processor_id") ?? "");
    const enabled = String(formData.get("enabled") ?? "false") === "true";
    await fetch(`${API_URL}/api/v1/projects/${projectId}/processors/${processorId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
      cache: "no-store",
    });
    revalidatePath(`/projects/${projectId}/processors`);
    redirect(`/projects/${projectId}/processors`);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6 space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Project Processors</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.projectName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Read-only processor inventory and runtime delivery health.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              {data.environment}
            </div>
            <Link href={`/projects/${projectId}/reliability`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Back to reliability
            </Link>
          </div>
        </div>
      </header>

      {data.sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Data source unavailable: {data.sourceErrors.join(", ")}.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Processors</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{data.processors.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Enabled</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{enabledCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent failures</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{failureCount}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Register Processor</h2>
        <form action={createProcessorAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Name
            <input
              name="name"
              required
              minLength={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              placeholder="Slack enrichment hook"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Event type
            <select
              name="event_type"
              defaultValue="trace_ingested"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="trace_ingested">trace_ingested</option>
              <option value="trace_evaluated">trace_evaluated</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground md:col-span-2">
            Endpoint URL
            <input
              name="endpoint_url"
              type="url"
              required
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              placeholder="https://processor.acme.test/ingest"
            />
          </label>
          <label className="text-xs text-muted-foreground md:col-span-2">
            Signing secret
            <input
              name="secret"
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              placeholder="processor-shared-secret"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
            <input name="enabled" type="checkbox" defaultChecked />
            Enable immediately
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Register processor
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Processor Inventory</h2>
        {data.processors.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No processors registered for this project.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.processors.map((processor) => (
              <article key={processor.id} className="rounded-lg border border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{processor.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${processor.enabled ? "bg-emerald-500/20 text-emerald-200" : "bg-muted text-muted-foreground"}`}>
                        {processor.enabled ? "enabled" : "disabled"}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {processor.event_type}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{processor.endpoint_url}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Created: {formatTime(processor.created_at)}</p>
                    <p>Last failure: {formatTime(processor.last_failure_at)}</p>
                    <p className={processor.recent_failure_count > 0 ? "text-red-300" : "text-emerald-300"}>
                      Recent failures: {processor.recent_failure_count}
                    </p>
                  </div>
                </div>
                <form action={updateProcessorAction} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="processor_id" value={processor.id} />
                  <label className="text-xs text-muted-foreground">
                    Name
                    <input
                      name="name"
                      defaultValue={processor.name}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Endpoint URL
                    <input
                      name="endpoint_url"
                      defaultValue={processor.endpoint_url}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground md:col-span-2">
                    Rotate signing secret (optional)
                    <input
                      name="secret"
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                      placeholder="Leave blank to keep existing secret"
                    />
                  </label>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                      Save changes
                    </button>
                  </div>
                </form>
                <form action={toggleProcessorAction} className="mt-2">
                  <input type="hidden" name="processor_id" value={processor.id} />
                  <input type="hidden" name="enabled" value={processor.enabled ? "false" : "true"} />
                  <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                    {processor.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
