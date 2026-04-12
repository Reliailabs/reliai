import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Database, Filter, HardDrive, Timer } from "lucide-react";

import { getProject, getProjectIngestionPolicy, updateProjectIngestionPolicy } from "@/lib/api";

export default async function ProjectIngestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, policy] = await Promise.all([
    getProject(id).catch(() => null),
    getProjectIngestionPolicy(id).catch(() => null),
  ]);

  if (!project || !policy) {
    notFound();
  }

  async function updatePolicyAction(formData: FormData) {
    "use server";

    const samplingSuccessRate = Number(formData.get("sampling_success_rate"));
    const samplingErrorRate = Number(formData.get("sampling_error_rate"));
    const maxMetadataFields = Number(formData.get("max_metadata_fields"));
    const maxCardinalityPerField = Number(formData.get("max_cardinality_per_field"));
    const retentionDaysSuccess = Number(formData.get("retention_days_success"));
    const retentionDaysError = Number(formData.get("retention_days_error"));

    await updateProjectIngestionPolicy(id, {
      sampling_success_rate: samplingSuccessRate,
      sampling_error_rate: samplingErrorRate,
      max_metadata_fields: maxMetadataFields,
      max_cardinality_per_field: maxCardinalityPerField,
      retention_days_success: retentionDaysSuccess,
      retention_days_error: retentionDaysError,
    });

    revalidatePath(`/projects/${id}/ingestion`);
    revalidatePath(`/projects/${id}`);
    redirect(`/projects/${id}/ingestion`);
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
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Ingestion pipeline</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Control which traces are stored, how much metadata is retained, and how long they persist.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Success sampling</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{policy.sampling_success_rate}%</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Error sampling</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{policy.sampling_error_rate}%</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Retention</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{policy.retention_days_success}d</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Filter className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Sampling focus</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Keep high‑resolution error traces for debugging while sampling successful traffic to manage cost.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <HardDrive className="mt-0.5 h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Retention tiers</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Error traces are kept longer for post‑mortem analysis; successful traces age out sooner.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Sampling rates</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Control what gets stored</h2>
            </div>
          </div>
          <form action={updatePolicyAction} className="mt-5 space-y-5">
            <div>
              <label htmlFor="sampling_success_rate" className="text-sm font-medium text-zinc-100">
                Success sampling rate (%)
              </label>
              <input
                id="sampling_success_rate"
                name="sampling_success_rate"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.sampling_success_rate}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Percentage of successful traces to retain. Lower to reduce cost.
              </p>
            </div>

            <div>
              <label htmlFor="sampling_error_rate" className="text-sm font-medium text-zinc-100">
                Error sampling rate (%)
              </label>
              <input
                id="sampling_error_rate"
                name="sampling_error_rate"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.sampling_error_rate}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Percentage of error traces to retain. Keep high for debugging.
              </p>
            </div>

            <div>
              <label htmlFor="max_metadata_fields" className="text-sm font-medium text-zinc-100">
                Max metadata fields per trace
              </label>
              <input
                id="max_metadata_fields"
                name="max_metadata_fields"
                type="number"
                min="1"
                max="1000"
                step="1"
                defaultValue={policy.max_metadata_fields}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Limit metadata cardinality to control storage growth.
              </p>
            </div>

            <div>
              <label htmlFor="max_cardinality_per_field" className="text-sm font-medium text-zinc-100">
                Max unique values per field
              </label>
              <input
                id="max_cardinality_per_field"
                name="max_cardinality_per_field"
                type="number"
                min="1"
                max="10000"
                step="1"
                defaultValue={policy.max_cardinality_per_field}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Limit distinct values per metadata field to avoid explosion.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
            >
              Update ingestion policy
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Timer className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Retention windows</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">How long traces persist</h2>
            </div>
          </div>
          <form action={updatePolicyAction} className="mt-5 space-y-5">
            <div>
              <label htmlFor="retention_days_success" className="text-sm font-medium text-zinc-100">
                Success retention (days)
              </label>
              <input
                id="retention_days_success"
                name="retention_days_success"
                type="number"
                min="1"
                max="365"
                step="1"
                defaultValue={policy.retention_days_success}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Days to keep successful traces before automatic deletion.
              </p>
            </div>

            <div>
              <label htmlFor="retention_days_error" className="text-sm font-medium text-zinc-100">
                Error retention (days)
              </label>
              <input
                id="retention_days_error"
                name="retention_days_error"
                type="number"
                min="1"
                max="365"
                step="1"
                defaultValue={policy.retention_days_error}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Days to keep error traces before automatic deletion.
              </p>
            </div>

            <div className="pt-4">
              <p className="text-sm font-medium text-zinc-100">Current policy summary</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-400">
                <p>• Success sampling: <span className="font-medium text-zinc-100">{policy.sampling_success_rate}%</span></p>
                <p>• Error sampling: <span className="font-medium text-zinc-100">{policy.sampling_error_rate}%</span></p>
                <p>• Max metadata fields: <span className="font-medium text-zinc-100">{policy.max_metadata_fields}</span></p>
                <p>• Max cardinality per field: <span className="font-medium text-zinc-100">{policy.max_cardinality_per_field}</span></p>
                <p>• Success retention: <span className="font-medium text-zinc-100">{policy.retention_days_success} days</span></p>
                <p>• Error retention: <span className="font-medium text-zinc-100">{policy.retention_days_error} days</span></p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}