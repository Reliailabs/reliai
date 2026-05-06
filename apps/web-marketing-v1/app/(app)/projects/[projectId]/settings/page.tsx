import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProject, updateProject } from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId).catch(() => null);

  if (!project) {
    notFound();
  }

  async function updateProjectAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    await updateProject(projectId, {
      name: name || undefined,
      slug: slug || undefined,
      description: description || null,
    });

    revalidatePath(`/projects/${projectId}/settings`);
    revalidatePath(`/projects/${projectId}/control`);
    redirect(`/projects/${projectId}/settings`);
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(15,23,42,0))] px-6 py-5">
          <Link href={`/projects/${projectId}/control`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to control panel
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Project settings</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Update the core project profile used in navigation, reporting, and incident summaries.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
              Environment · {project.environment}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Project profile</p>
          <form action={updateProjectAction} className="mt-4 space-y-4">
            <label className="block space-y-2 text-sm text-steel">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Name</span>
              <input
                name="name"
                defaultValue={project.name}
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </label>
            <label className="block space-y-2 text-sm text-steel">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Slug</span>
              <input
                name="slug"
                defaultValue={project.slug}
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
              <span className="text-xs text-steel">Lowercase letters, numbers, and dashes only.</span>
            </label>
            <label className="block space-y-2 text-sm text-steel">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Description</span>
              <textarea
                name="description"
                defaultValue={project.description ?? ""}
                rows={4}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-zinc-500"
              />
            </label>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Project metadata</p>
          <div className="mt-4 space-y-3 text-sm text-steel">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Project ID</span>
              <span className="text-sm font-medium text-ink">{project.id}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Active</span>
              <span className="text-sm font-medium text-ink">{project.is_active ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Created</span>
              <span className="text-sm font-medium text-ink">{formatDate(project.created_at)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-steel">Updated</span>
              <span className="text-sm font-medium text-ink">{formatDate(project.updated_at)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
