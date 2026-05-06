import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(15,23,42,0))] px-6 py-5">
          <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Organization settings</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">{organization.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                Update the workspace profile used for operator routing, billing context, and alert ownership.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-secondary">
              Plan · {organization.plan}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Organization profile</p>
          <form action={updateOrganizationAction} className="mt-4 space-y-4">
            <label className="block space-y-2 text-sm text-secondary">
              <span className="text-xs uppercase tracking-[0.2em] text-secondary">Name</span>
              <input
                name="name"
                defaultValue={organization.name}
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-primary outline-none transition focus:border-zinc-500"
              />
            </label>
            <label className="block space-y-2 text-sm text-secondary">
              <span className="text-xs uppercase tracking-[0.2em] text-secondary">Slug</span>
              <input
                name="slug"
                defaultValue={organization.slug}
                className="h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-sm text-primary outline-none transition focus:border-zinc-500"
              />
              <span className="text-xs text-secondary">Lowercase letters, numbers, and dashes only.</span>
            </label>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Organization metadata</p>
          <div className="mt-4 space-y-3 text-sm text-secondary">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-secondary">Organization ID</span>
              <span className="text-sm font-medium text-primary">{organization.id}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-secondary">Created</span>
              <span className="text-sm font-medium text-primary">{formatDate(organization.created_at)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.2em] text-secondary">Updated</span>
              <span className="text-sm font-medium text-primary">{formatDate(organization.updated_at)}</span>
            </div>
            {activeMembership ? (
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <span className="text-xs uppercase tracking-[0.2em] text-secondary">Your role</span>
                <span className="text-sm font-medium text-primary">{activeMembership.role}</span>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
