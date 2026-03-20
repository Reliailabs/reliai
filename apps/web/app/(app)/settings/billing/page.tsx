import { UsageMeter } from "@/components/dashboard/usage-meter";
import { BillingUpgradeButton } from "@/components/billing/upgrade-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOrganization, getOrganizationUsageQuota } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

const planDetails = [
  {
    name: "Team",
    price: "$49 / month",
    notes: ["5M traces included", "Collaboration + root cause", "Deployment compare"],
    planKey: "team"
  },
  {
    name: "Production",
    price: "$199 / month",
    notes: ["20M traces included", "Dashboards + alerts", "Audit-ready incidents"],
    planKey: "production",
    highlight: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    notes: ["Unlimited scale", "Dedicated reliability partner", "Custom retention"],
    planKey: "enterprise"
  }
];

const planBaseCosts: Record<string, number | null> = {
  free: 0,
  team: 49,
  production: 199,
  enterprise: null
};

function estimatePlanCost(used: number, base: number, included: number, overagePerMillion: number) {
  const overage = Math.max(used - included, 0);
  const overageCost = (overage / 1_000_000) * overagePerMillion;
  return base + overageCost;
}

export default async function BillingPage() {
  const session = await requireOperatorSession();
  const activeOrganizationId = session.active_organization_id;
  const organization = activeOrganizationId ? await getOrganization(activeOrganizationId).catch(() => null) : null;
  const usageQuota = activeOrganizationId
    ? await getOrganizationUsageQuota(activeOrganizationId).catch(() => null)
    : null;
  const usageStatus = usageQuota?.usage_status ?? null;
  const projected = usageStatus?.projected_usage ?? 0;
  const limit = usageStatus?.limit ?? 0;
  const currentPlan = organization?.plan ?? "free";
  const baseCost = planBaseCosts[currentPlan] ?? null;
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

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Billing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Usage, costs, and upgrades.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
          Keep your monitoring live during peak loads. Reduce overage costs and avoid trace loss.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Current plan</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{currentPlan}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Est. monthly cost</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{totalEstimated ? `$${totalEstimated.toFixed(0)}` : "—"}</p>
            </div>
          </div>
          {usageStatus && organization ? (
            <div className="mt-6">
              <UsageMeter
                usageStatus={usageStatus}
                plan={organization.plan}
                upgradePrompt={usageQuota?.upgrade_prompt ?? null}
                organizationId={organization.id}
              />
              {limit > 0 && projected > limit ? (
                <p className="mt-4 text-sm text-ink">
                  At your current rate, you will exceed your plan before month end.
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Cost breakdown</p>
          <h2 className="mt-3 text-xl font-semibold text-ink">Transparent billing, no surprises.</h2>
          <div className="mt-6 space-y-3 text-sm text-steel">
            <div className="flex items-center justify-between">
              <span>Base subscription</span>
              <span className="font-medium text-ink">{baseCost === null ? "Custom" : `$${baseCost}`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Usage</span>
              <span className="font-medium text-ink">${usageCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-sm font-semibold text-ink">
              <span>Total (estimated)</span>
              <span>{totalEstimated === null ? "Custom" : `$${totalEstimated.toFixed(2)}`}</span>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Upgrade to Production to maintain full visibility and reduce overage costs.
          </div>
          {teamEstimate !== null && productionEstimate !== null ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-ink">
              At your current usage:
              <div className="mt-2 flex items-center justify-between text-sm text-steel">
                <span>Team → ${teamEstimate.toFixed(0)} (growing)</span>
                <span>Production → ${productionEstimate.toFixed(0)} flat</span>
              </div>
              <p className="mt-2 text-xs text-steel">Production becomes cheaper than Team at your scale.</p>
            </div>
          ) : null}
          {enterpriseTrigger ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              You’re operating at enterprise scale. Talk to us about dedicated infrastructure and priority ingestion.
            </div>
          ) : null}
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {planDetails.map((plan) => (
          <Card
            key={plan.name}
            className={`rounded-[24px] border-zinc-300 p-5 ${plan.highlight ? "bg-zinc-50" : "bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
              {plan.highlight ? (
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">Recommended</span>
              ) : null}
            </div>
            <p className="mt-2 text-xl font-semibold text-ink">{plan.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-steel">
              {plan.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
            {plan.planKey === "enterprise" ? (
              <Button asChild className="mt-5 w-full" variant="outline">
                <a href="mailto:billing@reliai.dev">Contact sales</a>
              </Button>
            ) : organization ? (
              <div className="mt-5">
                <BillingUpgradeButton
                  organizationId={organization.id}
                  plan={plan.planKey as "team" | "production"}
                  label="Reduce overage costs"
                />
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      <Card className="rounded-[24px] border-zinc-300 bg-amber-50 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-900">Why teams upgrade now</p>
        <ul className="mt-4 space-y-2 text-sm text-amber-900">
          <li>• Avoid losing traces during incidents</li>
          <li>• Maintain full visibility under load</li>
          <li>• Keep teams aligned during reliability reviews</li>
          <li>• Ship changes without blind spots</li>
        </ul>
        {organization ? (
          <div className="mt-4">
            <BillingUpgradeButton organizationId={organization.id} plan="production" label="Reduce overage costs →" />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
