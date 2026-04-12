import { PageHeader } from "@/components/ui/page-header";
import { UsageMeter } from "@/components/ui/usage-meter";
import { getOrganization, getOrganizationUsageQuota, billingCheckout } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";
import { redirect } from "next/navigation";

const planDetails = [
  {
    name: "Team",
    price: "$49 / month",
    notes: ["5M traces included", "Collaboration + root cause", "Deployment compare"],
    planKey: "team",
  },
  {
    name: "Production",
    price: "$199 / month",
    notes: ["20M traces included", "Dashboards + alerts", "Audit-ready incidents"],
    planKey: "production",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    notes: ["Unlimited scale", "Dedicated reliability partner", "Custom retention"],
    planKey: "enterprise",
  },
];

const planBaseCosts: Record<string, number | null> = {
  free: 0,
  team: 49,
  production: 199,
  enterprise: null,
};

function estimatePlanCost(used: number, base: number, included: number, overagePerMillion: number) {
  const overage = Math.max(used - included, 0);
  const overageCost = (overage / 1_000_000) * overagePerMillion;
  return base + overageCost;
}

export default async function BillingPage() {
  const session = await requireOperatorSession();
  const activeOrganizationId = session.active_organization_id;
  const organization = activeOrganizationId
    ? await getOrganization(activeOrganizationId).catch(() => null)
    : null;
  const usageQuota = activeOrganizationId
    ? await getOrganizationUsageQuota(activeOrganizationId).catch(() => null)
    : null;
  const usageStatus = usageQuota?.usage_status ?? null;
  const projected = usageStatus?.projected_usage ?? 0;
  const limit = usageStatus?.limit ?? 0;
  const normalizedPlan = organization?.plan ?? "free";
  const currentPlanLabel = normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
  const baseCost = planBaseCosts[normalizedPlan] ?? null;
  const usageCost = usageStatus?.estimated_overage_cost ?? 0;
  const totalEstimated =
    baseCost === null ? null : Number.isFinite(baseCost) ? baseCost + usageCost : null;
  const enterpriseTrigger = (usageStatus?.used ?? 0) >= 100_000_000;
  const teamEstimate = usageStatus
    ? estimatePlanCost(usageStatus.used, 49, 5_000_000, 0.5)
    : null;
  const productionEstimate = usageStatus
    ? estimatePlanCost(usageStatus.used, 199, 20_000_000, 0.25)
    : null;

  async function handleBillingCheckout(plan: "team" | "production") {
    "use server";
    if (!organization) return;
    try {
      const response = await billingCheckout(organization.id, plan);
      if (response.checkout_url) {
        redirect(response.checkout_url);
      }
    } catch (error) {
      console.error("Failed to create checkout session", error);
    }
  }

  function UpgradeButton({ plan, label }: { plan: "team" | "production"; label: string }) {
    return (
      <form action={handleBillingCheckout.bind(null, plan)}>
        <button
          type="submit"
          className="w-full rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-3 text-sm font-semibold transition-colors"
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Usage, costs, and upgrades."
        description="Keep your monitoring live during peak loads. Reduce overage costs and avoid trace loss."
      />

      <div className="p-6 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Current plan</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">{currentPlanLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Est. monthly cost</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {totalEstimated ? `$${totalEstimated.toFixed(0)}` : "—"}
                </p>
              </div>
            </div>
             {usageStatus && organization && (
               <div className="mt-6">
                 <UsageMeter
                   used={usageStatus.used}
                   limit={limit}
                   projected={projected}
                 />
               </div>
             )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Cost breakdown</p>
            <h2 className="mt-3 text-xl font-semibold text-zinc-100">
              Transparent billing, no surprises.
            </h2>
            <div className="mt-6 space-y-3 text-sm text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Base subscription</span>
                <span className="font-medium text-zinc-100">
                  {baseCost === null ? "Custom" : `$${baseCost}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Usage</span>
                <span className="font-medium text-zinc-100">${usageCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-sm font-semibold text-zinc-100">
                <span>Total (estimated)</span>
                <span>{totalEstimated === null ? "Custom" : `$${totalEstimated.toFixed(2)}`}</span>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-amber-800 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
              Upgrade to Production to maintain full visibility and reduce overage costs.
            </div>
            {teamEstimate !== null && productionEstimate !== null && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
                At your current usage:
                <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                  <span>Team → ${teamEstimate.toFixed(0)} (growing)</span>
                  <span>Production → ${productionEstimate.toFixed(0)} flat</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Production becomes cheaper than Team at your scale.
                </p>
              </div>
            )}
            {enterpriseTrigger && (
              <div className="mt-4 rounded-xl border border-sky-800 bg-sky-900/20 px-4 py-3 text-sm text-sky-300">
                You’re operating at enterprise scale. Talk to us about dedicated infrastructure and priority ingestion.
              </div>
            )}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {planDetails.map((plan) => (
            <div
              key={plan.name}
              className={`bg-zinc-900 border border-zinc-800 rounded-[24px] p-5 ${
                plan.highlight ? "bg-zinc-800" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
                {plan.highlight && (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-900">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-semibold text-zinc-100">{plan.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                {plan.notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
              {plan.planKey === "enterprise" ? (
                <a
                  href="mailto:billing@reliai.dev"
                  className="mt-5 block w-full rounded-xl border border-zinc-700 bg-transparent px-4 py-3 text-sm font-semibold text-zinc-300 text-center hover:bg-zinc-800 transition-colors"
                >
                  Contact sales
                </a>
              ) : organization ? (
                <div className="mt-5">
                  <UpgradeButton
                    plan={plan.planKey as "team" | "production"}
                    label="Reduce overage costs"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Why teams upgrade now</p>
          <ul className="mt-4 space-y-2 text-sm text-amber-300">
            <li>• Avoid losing traces during incidents</li>
            <li>• Maintain full visibility under load</li>
            <li>• Keep teams aligned during reliability reviews</li>
            <li>• Ship changes without blind spots</li>
          </ul>
          {organization && (
            <div className="mt-4">
              <UpgradeButton plan="production" label="Reduce overage costs →" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}