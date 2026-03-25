import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Gauge, ListFilter, Regex, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  createProjectCustomMetric,
  getProject,
  listProjectCustomMetrics,
  updateProjectCustomMetric,
} from "@/lib/api";

export default async function ProjectCustomMetricsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, metricsResponse] = await Promise.all([
    getProject(projectId).catch(() => null),
    listProjectCustomMetrics(projectId).catch(() => null),
  ]);

  if (!project || !metricsResponse) {
    notFound();
  }

  const metrics = metricsResponse.items;

  async function createMetricAction(formData: FormData) {
    "use server";

    const metricType = String(formData.get("metric_type") ?? "keyword") as "regex" | "keyword";
    const valueMode = String(formData.get("value_mode") ?? "boolean") as "boolean" | "count";
    const keywordsRaw = String(formData.get("keywords") ?? "").trim();
    const keywords = keywordsRaw
      ? keywordsRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : null;

    await createProjectCustomMetric(projectId, {
      name: String(formData.get("name") ?? "").trim(),
      metric_type: metricType,
      value_mode: valueMode,
      pattern: String(formData.get("pattern") ?? "").trim() || null,
      keywords,
      enabled: true,
    });

    revalidatePath(`/projects/${projectId}/metrics`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(`/projects/${projectId}/metrics`);
  }

  async function toggleMetricAction(formData: FormData) {
    "use server";

    const metricId = String(formData.get("metric_id") ?? "");
    const enabled = String(formData.get("enabled") ?? "false") === "true";
    await updateProjectCustomMetric(projectId, metricId, { enabled });

    revalidatePath(`/projects/${projectId}/metrics`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(`/projects/${projectId}/metrics`);
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0))] px-6 py-5">
          <Link href={`/projects/${projectId}/control`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to control panel
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Behavioral signal config</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Define project-level custom metrics using regex or keyword matching so your team can track behavior
                shifts without waiting for new product hardcoding.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Total metrics</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{metrics.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Enabled</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{metrics.filter((item) => item.enabled).length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Signal type</p>
                <p className="mt-2 text-2xl font-semibold text-ink">Regex + Keywords</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Create custom metric</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Add a behavioral signal</h2>
            </div>
          </div>

          <form action={createMetricAction} className="mt-6 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">Metric name</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Refusal language"
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="metric_type" className="text-sm font-medium text-ink">Type</label>
                <select
                  id="metric_type"
                  name="metric_type"
                  defaultValue="keyword"
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                >
                  <option value="keyword">keyword</option>
                  <option value="regex">regex</option>
                </select>
              </div>
              <div>
                <label htmlFor="value_mode" className="text-sm font-medium text-ink">Result mode</label>
                <select
                  id="value_mode"
                  name="value_mode"
                  defaultValue="boolean"
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                >
                  <option value="boolean">boolean hit/miss</option>
                  <option value="count">count matches</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pattern" className="text-sm font-medium text-ink">Regex pattern (for regex type)</label>
              <input
                id="pattern"
                name="pattern"
                maxLength={500}
                placeholder="i\s+cannot\s+help\s+with\s+that"
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="keywords" className="text-sm font-medium text-ink">Keywords (comma-separated, for keyword type)</label>
              <textarea
                id="keywords"
                name="keywords"
                rows={3}
                placeholder="cannot help, unable to assist, can't provide"
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Save custom metric
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ListFilter className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Configured metrics</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Project custom metric registry</h2>
              </div>
            </div>
            {metrics.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No custom metrics are configured yet. Add one to start tracking a project-specific behavior signal.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {metrics.map((metric) => (
                  <div key={metric.id} className="rounded-[22px] border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{metric.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-steel">{metric.metric_key}</p>
                      </div>
                      <form action={toggleMetricAction}>
                        <input type="hidden" name="metric_id" value={metric.id} />
                        <input type="hidden" name="enabled" value={String(!metric.enabled)} />
                        <button
                          type="submit"
                          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                            metric.enabled
                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                          }`}
                        >
                          {metric.enabled ? "enabled" : "disabled"}
                        </button>
                      </form>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-steel md:grid-cols-2">
                      <p>
                        Type: <span className="font-medium text-ink">{metric.metric_type}</span>
                      </p>
                      <p>
                        Mode: <span className="font-medium text-ink">{metric.value_mode}</span>
                      </p>
                    </div>
                    {metric.pattern ? <p className="mt-2 text-sm text-steel">Pattern: {metric.pattern}</p> : null}
                    {metric.keywords_json && metric.keywords_json.length > 0 ? (
                      <p className="mt-2 text-sm text-steel">Keywords: {metric.keywords_json.join(", ")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Behavior signal guidance</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Keep metrics narrow and operational</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-steel">
              <p className="rounded-2xl border border-zinc-200 px-4 py-3">
                <Regex className="mr-2 inline h-4 w-4 align-text-bottom" />
                Use regex for strict phrase families where tiny wording changes matter.
              </p>
              <p className="rounded-2xl border border-zinc-200 px-4 py-3">
                Use keyword mode for broad operational classes like refusal, escalation, or apology language.
              </p>
              <p className="rounded-2xl border border-zinc-200 px-4 py-3">
                Metrics run on every trace evaluation and roll into the same regression pipeline as core signals.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
