import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/ui/page-header";
import { getOrganization, updateOrganization } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function formatDate(value: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

export default async function OrganizationSettingsPage() {
  const session = await requireOperatorSession();
  const activeOrganizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  if (!activeOrganizationId) {
    notFound();
  }
  const organization = await getOrganization(activeOrganizationId).catch(() => null);

  if (!organization) {
    notFound();
  }

  const activeMembership =
    session.memberships.find((membership) => membership.organization_id === activeOrganizationId) ?? null;

  async function updateOrganizationAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();

    await updateOrganization(activeOrganizationId, {
      name: name || undefined,
      slug: slug || undefined,
    });

    revalidatePath("/organization/settings");
    revalidatePath("/settings");
    redirect("/organization/settings");
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title={organization.name}
        description="Update the workspace profile used for operator routing, billing context, and alert ownership."
        right={
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            Plan · {organization.plan}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Organization profile</p>
            <form action={updateOrganizationAction} className="mt-4 space-y-4">
              <label className="block space-y-2 text-sm text-zinc-400">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</span>
                <input
                  name="name"
                  defaultValue={organization.name}
                  className="h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 outline-none transition focus:border-zinc-600"
                />
              </label>
              <label className="block space-y-2 text-sm text-zinc-400">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Slug</span>
                <input
                  name="slug"
                  defaultValue={organization.slug}
                  className="h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 outline-none transition focus:border-zinc-600"
                />
                <span className="text-xs text-zinc-500">Lowercase letters, numbers, and dashes only.</span>
              </label>
              <button
                type="submit"
                className="rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-3 text-sm font-semibold transition-colors"
              >
                Save changes
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Organization metadata</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Organization ID</span>
                <span className="text-sm font-medium text-zinc-100">{organization.id}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Created</span>
                <span className="text-sm font-medium text-zinc-100">{formatDate(organization.created_at)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Updated</span>
                <span className="text-sm font-medium text-zinc-100">{formatDate(organization.updated_at)}</span>
              </div>
              {activeMembership && (
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Your role</span>
                  <span className="text-sm font-medium text-zinc-100">{activeMembership.role}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}