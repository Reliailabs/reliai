import { PageHeader } from "@/components/ui/page-header";
import { PanelError } from "@/components/ui/panel-error";
import { getOrganizationPolicies } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

export default async function GuardrailsPage() {
  const session = await requireOperatorSession();
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id;
  let policies = { items: [] as Awaited<ReturnType<typeof getOrganizationPolicies>>["items"] };
  let hasError = false;
  if (orgId) {
    try {
      policies = await getOrganizationPolicies(orgId);
    } catch {
      hasError = true;
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Guardrails"
        description="Policy coverage and guardrail activation for production AI workflows."
      />
      <div className="p-6">
        {hasError ? (
          <div className="mb-4">
            <PanelError detail="Guardrail policy source is currently unavailable." />
          </div>
        ) : null}
        {policies.items.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            No guardrail policies configured. Enable at least one policy to reduce unsafe output exposure.
          </div>
        ) : (
          <div className="grid gap-3">
            {policies.items.map((policy) => (
              <div key={policy.id} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-100">{policy.policy_type}</p>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] uppercase ${
                      policy.enabled
                        ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                        : "border-zinc-700 bg-zinc-950 text-zinc-400"
                    }`}
                  >
                    {policy.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Mode: {policy.enforcement_mode}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
