import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Database, EyeOff, Filter, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getProject,
  getProjectIngestionPolicy,
  updateProjectIngestionPolicy,
} from "@/lib/api";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function ProjectIngestionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, policy] = await Promise.all([
    getProject(projectId).catch(() => null),
    getProjectIngestionPolicy(projectId).catch(() => null),
  ]);

  if (!project || !policy) {
    notFound();
  }

  async function updatePolicyAction(formData: FormData) {
    "use server";
    await updateProjectIngestionPolicy(projectId, {
      sampling_success_rate: Number(formData.get("sampling_success_rate") ?? 1),
      sampling_error_rate: Number(formData.get("sampling_error_rate") ?? 1),
      max_metadata_fields: Number(formData.get("max_metadata_fields") ?? 50),
      max_cardinality_per_field: Number(formData.get("max_cardinality_per_field") ?? 250),
      retention_days_success: Number(formData.get("retention_days_success") ?? 14),
      retention_days_error: Number(formData.get("retention_days_error") ?? 30),
    });
    revalidatePath(`/projects/${projectId}/ingestion`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(`/projects/${projectId}/ingestion`);
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
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace ingestion control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Set how much downstream trace traffic Reliai processes, cap metadata cardinality before
                it destabilizes operators and pipelines, and keep sensitive keys out of persisted telemetry.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Success sample</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{percent(policy.sampling_success_rate)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Error sample</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{percent(policy.sampling_error_rate)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-steel">Tracked fields</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{policy.cardinality_summary.length}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <Database className="mt-0.5 h-5 w-5 text-steel" />
            <div>
              <p className="text-sm font-medium text-ink">Volume control</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                Sampling applies to downstream `trace_ingested` processing, not request acceptance. Operators
                keep a persisted trace record while expensive async processing stays bounded.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-ink">Policy baseline</p>
              <p className="mt-1 text-sm leading-6 text-steel">
                Current policy was established {new Date(policy.created_at).toLocaleString()} and applies at the
                project default scope unless an environment override is added later.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Policy editor</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Sampling, retention, and metadata caps</h2>
            </div>
          </div>
          <form action={updatePolicyAction} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="sampling_success_rate" className="text-sm font-medium text-ink">Sampling: successful traces</label>
                <input
                  id="sampling_success_rate"
                  name="sampling_success_rate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  defaultValue={policy.sampling_success_rate}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="sampling_error_rate" className="text-sm font-medium text-ink">Sampling: error traces</label>
                <input
                  id="sampling_error_rate"
                  name="sampling_error_rate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  defaultValue={policy.sampling_error_rate}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="max_metadata_fields" className="text-sm font-medium text-ink">Cardinality protection: max metadata fields</label>
                <input
                  id="max_metadata_fields"
                  name="max_metadata_fields"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={policy.max_metadata_fields}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="max_cardinality_per_field" className="text-sm font-medium text-ink">Cardinality protection: unique values per field</label>
                <input
                  id="max_cardinality_per_field"
                  name="max_cardinality_per_field"
                  type="number"
                  min="1"
                  max="5000"
                  defaultValue={policy.max_cardinality_per_field}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="retention_days_success" className="text-sm font-medium text-ink">Retention: successful traces (days)</label>
                <input
                  id="retention_days_success"
                  name="retention_days_success"
                  type="number"
                  min="1"
                  max="3650"
                  defaultValue={policy.retention_days_success}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="retention_days_error" className="text-sm font-medium text-ink">Retention: error traces (days)</label>
                <input
                  id="retention_days_error"
                  name="retention_days_error"
                  type="number"
                  min="1"
                  max="3650"
                  defaultValue={policy.retention_days_error}
                  className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Save ingestion policy
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <EyeOff className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Field filtering</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Sensitive-key redaction</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-steel">
              Metadata keys that look like credentials or session identifiers are persisted as `[redacted]`
              before they reach downstream processors.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {policy.sensitive_field_patterns.map((item) => (
                <span key={item} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                  {item}
                </span>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Cardinality protection</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Tracked metadata fields</h2>
              </div>
            </div>
            {policy.cardinality_summary.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No metadata fields have accumulated enough traffic to show a tracked cardinality profile yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {policy.cardinality_summary.slice(0, 8).map((item) => (
                  <div key={item.field_name} className="rounded-[22px] border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{item.field_name}</p>
                        <p className="mt-1 text-sm text-steel">{item.unique_values_count} unique values observed</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${item.limit_reached ? "bg-rose-100 text-rose-700 ring-rose-200" : "bg-emerald-100 text-emerald-700 ring-emerald-200"}`}>
                        {item.limit_reached ? "at limit" : "within limit"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Result</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Current enforcement outcome</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Successful traces published downstream</span>
                <span className="text-sm font-medium text-ink">{percent(policy.sampling_success_rate)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Error traces published downstream</span>
                <span className="text-sm font-medium text-ink">{percent(policy.sampling_error_rate)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Top-level metadata fields allowed per trace</span>
                <span className="text-sm font-medium text-ink">{policy.max_metadata_fields}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Unique values allowed per field</span>
                <span className="text-sm font-medium text-ink">{policy.max_cardinality_per_field}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
