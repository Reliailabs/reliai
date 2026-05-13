import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import { getProjectIngestionSurfaceData } from "@/lib/project-ingestion-data";

type ProjectIngestionPageProps = {
  params: Promise<{ projectId: string }>;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function policyTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

export default async function ProjectIngestionPage({ params }: ProjectIngestionPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();

  const data = await getProjectIngestionSurfaceData(projectId);
  const policy = data.policy;

  async function updatePolicyAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;
    await fetch(`${API_URL}/api/v1/projects/${projectId}/ingestion-policy`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sampling_success_rate: Number(formData.get("sampling_success_rate") ?? 1),
        sampling_error_rate: Number(formData.get("sampling_error_rate") ?? 1),
        max_metadata_fields: Number(formData.get("max_metadata_fields") ?? 50),
        max_cardinality_per_field: Number(formData.get("max_cardinality_per_field") ?? 250),
        retention_days_success: Number(formData.get("retention_days_success") ?? 14),
        retention_days_error: Number(formData.get("retention_days_error") ?? 30),
      }),
      cache: "no-store",
    });
    revalidatePath(`/projects/${projectId}/ingestion`);
    redirect(`/projects/${projectId}/ingestion`);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6 space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trace Ingestion Control</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.projectName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Read-only ingestion policy view for sampling, retention, and metadata cardinality protection.
            </p>
          </div>
          <div className="flex gap-2">
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

      {!policy ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No ingestion policy found for this project.
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Success sampling</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{percent(policy.sampling_success_rate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Error sampling</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{percent(policy.sampling_error_rate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Metadata fields cap</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{policy.max_metadata_fields}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cardinality cap</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{policy.max_cardinality_per_field}</p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Policy Editor</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Update sampling, retention, and cardinality limits.
              </p>
              <form action={updatePolicyAction} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Success sampling
                  <input
                    name="sampling_success_rate"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue={policy.sampling_success_rate}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Error sampling
                  <input
                    name="sampling_error_rate"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue={policy.sampling_error_rate}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Metadata fields cap
                  <input
                    name="max_metadata_fields"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={policy.max_metadata_fields}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Cardinality cap
                  <input
                    name="max_cardinality_per_field"
                    type="number"
                    min="1"
                    max="5000"
                    defaultValue={policy.max_cardinality_per_field}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Success retention (days)
                  <input
                    name="retention_days_success"
                    type="number"
                    min="1"
                    max="3650"
                    defaultValue={policy.retention_days_success}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Error retention (days)
                  <input
                    name="retention_days_error"
                    type="number"
                    min="1"
                    max="3650"
                    defaultValue={policy.retention_days_error}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Save ingestion policy
                  </button>
                </div>
              </form>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Retention Policy</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Successful traces: <span className="text-foreground">{policy.retention_days_success} days</span></p>
                <p>Error traces: <span className="text-foreground">{policy.retention_days_error} days</span></p>
                <p>Policy established: <span className="text-foreground">{policyTime(policy.created_at)}</span></p>
              </div>
            </article>

            <article className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Sensitive Key Redaction</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {policy.sensitive_field_patterns.length > 0 ? policy.sensitive_field_patterns.map((pattern) => (
                  <span key={pattern} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    {pattern}
                  </span>
                )) : <p className="text-sm text-muted-foreground">No sensitive-key patterns configured.</p>}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Metadata Cardinality Summary</h2>
            {policy.cardinality_summary.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No metadata cardinality records yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {policy.cardinality_summary.slice(0, 12).map((item) => (
                  <div key={item.field_name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{item.field_name}</p>
                      <p className="text-muted-foreground">{item.unique_values_count} unique values</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.limit_reached ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200"}`}>
                      {item.limit_reached ? "at limit" : "within limit"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
