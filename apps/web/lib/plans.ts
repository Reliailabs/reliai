export type Plan = "free" | "team" | "production" | "enterprise";

export function normalizePlan(plan?: string | null): Plan {
  const value = (plan ?? "free").trim().toLowerCase();
  if (value === "pilot") return "team";
  if (value === "growth") return "production";
  if (value === "free" || value === "team" || value === "production" || value === "enterprise") {
    return value;
  }
  return "free";
}

export function formatPlanLabel(plan?: string | null): string {
  const normalized = normalizePlan(plan);
  if (normalized === "free") return "Free";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
