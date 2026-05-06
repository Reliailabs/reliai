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

type MetricTemplate = {
  name: string;
  metric_type: "keyword" | "regex";
  value_mode: "boolean" | "count";
  pattern: string;
  keywords: string;
};

const METRIC_TEMPLATES: Record<string, MetricTemplate> = {
  refusal_language: {
    name: "Refusal language",
    metric_type: "keyword",
    value_mode: "boolean",
    pattern: "",
    keywords: "I cannot help, I'm unable, I can't provide, I cannot assist",
  },
  apology_language: {
    name: "Apology language",
    metric_type: "keyword",
    value_mode: "boolean",
    pattern: "",
    keywords: "I'm sorry, I apologize, I regret",
  },
  policy_violation: {
    name: "Policy violation",
    metric_type: "regex",
    value_mode: "boolean",
    pattern: String.raw`\b(forbidden|not allowed|policy violation|restricted)\b`,
    keywords: "",
  },
  safety_blocks: {
    name: "Safety blocks",
    metric_type: "keyword",
    value_mode: "count",
    pattern: "",
    keywords: "blocked, safety policy, unsafe request, disallowed content",
  },
};

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function parseKeywords(value: string | undefined) {
  if (!value) return "";
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export default async function ProjectCustomMetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const templateKey = typeof resolvedSearch.template === "string" ? resolvedSearch.template : undefined;
  const tpl = templateKey ? (METRIC_TEMPLATES[templateKey] ?? null) : null;
  const prefillName = readParam(resolvedSearch.name);
  const prefillType = readParam(resolvedSearch.metric_type) as MetricTemplate["metric_type"] | undefined;
  const prefillMode = readParam(resolvedSearch.value_mode) as MetricTemplate["value_mode"] | undefined;
  const prefillPattern = readParam(resolvedSearch.pattern);
  const prefillKeywords = parseKeywords(readParam(resolvedSearch.keywords));
  const prefillSource = readParam(resolvedSearch.source);
  const createdFlag = readParam(resolvedSearch.created) === "1";
  const createdName = readParam(resolvedSearch.created_name);
  const highlightForm = Boolean(tpl || prefillName || prefillPattern || prefillKeywords || prefillSource);
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

    const metricName = String(formData.get("name") ?? "").trim();
    await createProjectCustomMetric(projectId, {
      name: metricName,
      metric_type: metricType,
      value_mode: valueMode,
      pattern: String(formData.get("pattern") ?? "").trim() || null,
      keywords,
      enabled: true,
    });

    revalidatePath(`/projects/${projectId}/metrics`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(
      `/projects/${projectId}/metrics?created=1&created_name=${encodeURIComponent(metricName)}`
    );
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

      {createdFlag ? (
        <Card className="rounded-[28px] border-amber-200 bg-amber-50/60 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-700">Metric enabled</p>
          <h2 className="mt-2 text-xl font-semibold text-amber-950">
            {createdName ? `${createdName} is now tracked` : "Metric is now tracked"}
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            This signal now feeds Reliability and incident detection.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={`/projects/${projectId}/reliability`}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 transition hover:border-amber-400 hover:text-amber-950"
            >
              View in reliability
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/traces?project_id=${encodeURIComponent(projectId)}`}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 hover:text-amber-950"
            >
              View recent traces
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
        <Card className={`rounded-[28px] border-zinc-300 p-6 ${highlightForm ? "border-amber-200 bg-amber-50/40" : ""}`}>
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Create custom metric</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Add a behavioral signal</h2>
              {prefillSource ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Recommended from {prefillSource.replaceAll("_", " ")}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Quick templates</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(METRIC_TEMPLATES).map(([key, t]) => (
                <Link
                  key={key}
                  href={`/projects/${projectId}/metrics?template=${key}`}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition hover:border-zinc-400 ${
                    templateKey === key
                      ? "border-ink bg-ink text-white"
                      : "border-zinc-300 bg-white text-steel"
                  }`}
                >
                  {t.name}
                </Link>
              ))}
              {templateKey ? (
                <Link
                  href={`/projects/${projectId}/metrics`}
                  className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs text-steel hover:border-zinc-400"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </div>

          <form action={createMetricAction} className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">Metric name</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Refusal language"
                defaultValue={prefillName ?? tpl?.name ?? ""}
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="metric_type" className="text-sm font-medium text-ink">Type</label>
                <select
                  id="metric_type"
                  name="metric_type"
                  defaultValue={prefillType ?? tpl?.metric_type ?? "keyword"}
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
                  defaultValue={prefillMode ?? tpl?.value_mode ?? "boolean"}
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
                defaultValue={prefillPattern ?? tpl?.pattern ?? ""}
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
                defaultValue={prefillKeywords || tpl?.keywords || ""}
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Create metric
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
                <p className="text-sm font-medium text-ink">Track behaviors that matter</p>
                <p className="mt-2">
                  Create a metric to track refusal language, policy violations, or any custom pattern in outputs.
                </p>
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
                    <p className="mt-2 text-sm text-steel">
                      {metric.enabled
                        ? "Enabled — this metric is now tracked in Reliability and Incidents."
                        : "Disabled — no new incidents or signals will be created."}
                    </p>
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
