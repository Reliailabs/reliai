"use client";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentCost: number;
  targetPlan: "team" | "production";
};

const planCopy = {
  team: {
    name: "Team",
    price: "$49 / month",
    includes: ["5M traces included", "Team collaboration", "Deployment compare"]
  },
  production: {
    name: "Production",
    price: "$199 / month",
    includes: ["20M traces included", "No ingestion interruptions", "Dashboards + alerts"]
  }
};

export function UpgradeSheet({ open, onClose, onConfirm, currentCost, targetPlan }: Props) {
  if (!open) return null;
  const plan = planCopy[targetPlan];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30">
      <div className="w-full rounded-t-2xl bg-surface p-6 shadow-none">
        <h2 className="text-lg font-semibold text-primary">Upgrade to {plan.name}</h2>
        <p className="mt-2 text-sm text-secondary">Reduce overage costs and keep full observability.</p>

        <div className="mt-4 rounded-xl border border-line bg-surfaceAlt px-4 py-3 text-sm text-primary">
          <div className="flex items-center justify-between">
            <span>New plan</span>
            <span className="font-semibold">{plan.name}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Price</span>
            <span className="font-semibold">{plan.price}</span>
          </div>
        </div>

        <div className="mt-4 text-sm text-primary">
          Includes:
          <ul className="mt-2 space-y-1 text-sm text-secondary">
            {plan.includes.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 text-sm text-primary">
          Estimated cost this month: ${currentCost.toFixed(0)} → {plan.price}
        </div>

        <Button className="mt-5 w-full" onClick={onConfirm}>
          Reduce overage costs →
        </Button>
        <button type="button" onClick={onClose} className="mt-3 w-full text-sm text-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
