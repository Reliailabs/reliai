import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ArrowRight, Building, Edit, Hash, Text } from "lucide-react";

import { getProject, updateProject } from "@/lib/api";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) {
    notFound();
  }

  async function updateProjectAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    await updateProject(id, {
      name: name || null,
      slug: slug || null,
      description: description || null,
    });

    revalidatePath(`/projects/${id}/settings`);
    revalidatePath(`/projects/${id}`);
    redirect(`/projects/${id}/settings`);
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
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Project configuration</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Edit project profile, identifier, and description. Changes affect how this project appears across Reliai.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Environment</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{project.environment}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Created</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Status</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">Active</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Building className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Project identity</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                The name and slug are used in URLs, dashboards, and API references. Choose a clear, memorable identifier.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <Edit className="mt-0.5 h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">Non‑destructive</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Changing these fields does not affect existing traces, incidents, or reliability metrics.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Text className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Project details</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Edit profile</h2>
            </div>
          </div>
          <form action={updateProjectAction} className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-zinc-100">Project name</label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={project.name}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Display name used across dashboards and reports.
              </p>
            </div>

            <div>
              <label htmlFor="slug" className="text-sm font-medium text-zinc-100">Project slug</label>
              <input
                id="slug"
                name="slug"
                required
                pattern="[a-z0-9\-]+"
                title="Lowercase letters, numbers, hyphens only"
                defaultValue={project.slug}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Unique identifier used in URLs and API references. Lowercase, hyphens allowed.
              </p>
            </div>

            <div>
              <label htmlFor="description" className="text-sm font-medium text-zinc-100">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description ?? ""}
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-sm text-zinc-400">
                Optional context about this project’s purpose, team, or key models.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
            >
              Save project settings
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Project metadata</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">System fields</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between border-b border-zinc-800 py-3">
              <span className="text-zinc-400">Project ID</span>
              <span className="font-mono text-zinc-100">{project.id}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 py-3">
              <span className="text-zinc-400">Organization ID</span>
              <span className="font-mono text-zinc-100">{project.organization_id}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 py-3">
              <span className="text-zinc-400">Created at</span>
              <span className="text-zinc-100">{new Date(project.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 py-3">
              <span className="text-zinc-400">Updated at</span>
              <span className="text-zinc-100">{new Date(project.updated_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-800 py-3">
              <span className="text-zinc-400">Environment</span>
              <span className="text-zinc-100">{project.environment}</span>
            </div>

          </div>
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4">
            <p className="text-sm font-medium text-zinc-100">Danger zone</p>
            <p className="mt-2 text-sm text-zinc-400">
              Deleting this project will remove all traces, incidents, and reliability data permanently.
              This action cannot be undone.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center rounded-full border border-rose-800 bg-rose-950/30 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-950/60"
              disabled
            >
              Delete project (disabled)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}