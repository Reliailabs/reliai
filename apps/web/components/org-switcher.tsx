import { revalidatePath } from "next/cache";

import { switchOrganization } from "@/lib/auth";

export async function OrgSwitcher({
  memberships,
  activeOrganizationId
}: {
  memberships: Array<{ organization_id: string; organization_name?: string | null; role: string }>;
  activeOrganizationId?: string | null;
}) {
  if (memberships.length <= 1) {
    return null;
  }

  async function switchOrganizationAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") || "");
    if (!organizationId) {
      return;
    }
    await switchOrganization(organizationId);
    revalidatePath("/");
  }

  return (
    <form action={switchOrganizationAction} className="mt-4 space-y-2">
      <label className="block text-[11px] uppercase tracking-[0.18em] text-steel">Organization</label>
      <div className="flex gap-2">
        <select
          name="organization_id"
          defaultValue={activeOrganizationId ?? memberships[0]?.organization_id}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {memberships.map((membership) => (
            <option key={membership.organization_id} value={membership.organization_id}>
              {membership.organization_name ?? membership.organization_id}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
          Switch
        </button>
      </div>
    </form>
  );
}
