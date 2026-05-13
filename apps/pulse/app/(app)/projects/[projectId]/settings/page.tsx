import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getApiAccessToken, requireOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { getProjectSettingsSurfaceData } from "@/lib/project-settings-data";

type ProjectSettingsPageProps = {
  params: Promise<{ projectId: string }>;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

export default async function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();

  const data = await getProjectSettingsSurfaceData(projectId);
  const project = data.project;

  async function updateProjectAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name || undefined,
        slug: slug || undefined,
        description: description || null,
      }),
      cache: "no-store",
    });

    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath(`/projects/${projectId}/reliability`);
    redirect(`/projects/${projectId}/settings`);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-6 space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Project Settings</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{project?.name ?? "Project"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Update project profile fields used by project navigation and reporting surfaces.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              {project?.environment ?? "unknown"}
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

      {!project ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Project settings are unavailable.
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Project Profile</h2>
            <form action={updateProjectAction} className="mt-4 space-y-3 text-sm">
              <label className="block rounded-lg border border-border px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</p>
                <input
                  name="name"
                  defaultValue={project.name}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Slug</p>
                <input
                  name="slug"
                  defaultValue={project.slug ?? ""}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</p>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={project.description ?? ""}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
                />
              </label>
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Save changes
              </button>
            </form>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Project Metadata</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Project ID</span>
                <span className="text-foreground">{project.id}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Active</span>
                <span className="text-foreground">{project.is_active ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Created</span>
                <span className="text-foreground">{formatDate(project.created_at)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>Updated</span>
                <span className="text-foreground">{formatDate(project.updated_at)}</span>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
