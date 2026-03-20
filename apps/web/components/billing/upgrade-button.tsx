"use client";

import { Button } from "@/components/ui/button";

export function BillingUpgradeButton({
  organizationId,
  plan,
  label,
  variant = "default",
  disabled = false
}: {
  organizationId: string;
  plan: "team" | "production";
  label: string;
  variant?: "default" | "outline" | "subtle";
  disabled?: boolean;
}) {
  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, plan })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { checkout_url?: string };
    if (payload.checkout_url) {
      window.location.href = payload.checkout_url;
    }
  }

  return (
    <Button variant={variant} className="w-full" onClick={handleUpgrade} disabled={disabled}>
      {label}
    </Button>
  );
}
